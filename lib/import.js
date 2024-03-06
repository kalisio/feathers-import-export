import _ from 'lodash'
import { promisify } from 'util'
import { pipeline, Writable } from 'stream'
import { importers } from './importers/index.js'
import { transform } from './utils.js'

import createDebug from 'debug'
const debug = createDebug('feathers-import-export:import')

// Helper writable stream to the service defined in the data
class ServiceWriteStream extends Writable {
  constructor(data) {
    super(Object.assign(data, { objectMode: true }))
    this.data = data
    this.chunkCount = 0
    this.objectCount = 0
  }
  async _write(chunk, encoding, next) {
    this.chunkCount++
    this.objectCount += Array.isArray(chunk) ? chunk.length : 1
    if (this.data.transform) {
      if (typeof this.data.transform === 'function') chunk = await this.transform(chunk, this.data)
      else chunk = transform(chunk, this.data.transform)
    }
    await this.data.service.create(chunk)
    next()
  }
}

export async function _import (data) {
  debug(`Import file with data ${JSON.stringify(_.omit(data, 's3Service'), null, 2)}`)
  // retrieve the stream to the s3 object
  let response = await data.s3Service.getObjectCommand({  
    id: data.id,
    context: data
  })
  // create the stream to the desired service
  const serviceWriteStream = new ServiceWriteStream(Object.assign({ contentType: response.ContentType }, data))
  // retrieve the importer
  const importer = importers[response.ContentType]
  if (!importer) throw new Error(`import: content type '${response.ContentType}' not supported`)
  // run the pipeline
  await promisify(pipeline)(response.Body, importer.stream(), serviceWriteStream)
  // notify and return the response
  response = {
    uuid: data.uuid,
    id: data.id,
    chunks: serviceWriteStream.chunkCount, 
    objects: serviceWriteStream.objectCount 
  }
  return response
}