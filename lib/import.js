import _ from 'lodash'
import { promisify } from 'util'
import { pipeline, Writable } from 'stream'
import { importers } from './importers/index.js'
import { transform } from './utils.js'

import createDebug from 'debug'
const debug = createDebug('feathers-import-export:import')

// Helper writable stream to the service defined in the options
class ServiceWriteStream extends Writable {
  constructor(options) {
    super(Object.assign(options, { objectMode: true }))
    this.service = options.service
    this.transform = options.transform
    this.chunkCount = 0
    this.objectCount = 0
  }
  async _write(chunk, encoding, next) {
    this.chunkCount++
    this.objectCount += Array.isArray(chunk) ? chunk.length : 1
    if (this.transform) {
      if (typeof this.transform === 'function') chunk = await this.transform(chunk)
      else chunk = transform(chunk, this.transform)
    }
    await this.service.create(chunk)
    next()
  }
}

export async function _import (options) {
  debug(`Import file with options ${JSON.stringify(_.omit(options, 's3Service'), null, 2)}`)
  // retrieve the stream to the s3 object
  const response = await options.s3Service.getObjectCommand({  id: options.id })
  // create the stream to the desired service
  const serviceWriteStream = new ServiceWriteStream(Object.assign({ contentType: response.ContentType }, options))
  // retrieve the importer
  const importer = importers[response.ContentType]
  if (!importer) throw new Error(`import: content type '${response.ContentType}' not supported`)
  // run the pipeline
  await promisify(pipeline)(response.Body, importer.stream(), serviceWriteStream)
  return { 
    id: options.id,
    chunks: serviceWriteStream.chunkCount, 
    objects: serviceWriteStream.objectCount 
  }
}