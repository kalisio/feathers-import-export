import { promisify } from 'util'
import { pipeline, Writable } from 'stream'
import { importers } from './importers/index.js'
import { transform } from './utils.js'

import createDebug from 'debug'
const debug = createDebug('feathers-import-export:import')

// Helper writable stream to the service defined in the options
class ServiceStream extends Writable {
  constructor(options) {
    super(Object.assign(options, { objectMode: true }))
    this.service = options.service
    this.transform = options.transform
  }
  async _write(chunk, encoding, next) {
    if (this.transform) chunk = transform(chunk, this.transform)
    await this.service.create(chunk)
    next()
  }
}

export async function _import (options) {
  debug(`Import file with options ${JSON.stringify(options, null, 2)}`)
  // create the stream to the desired service
  const serviceStream = new ServiceStream(options)
  // retrieve the stream to the s3 object
  const response = await options.s3Service.getObjectCommand({  id: options.id })
  // retrieve the importer
  const importer = importers[response.ContentType]
  if (!importer) throw new Error(`import: content type '${response.ContentType}' not supported`)
  // run the pipeline
  return promisify(pipeline)(response.Body, importer.stream(), serviceStream)
}