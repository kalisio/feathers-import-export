import _ from 'lodash'
import path from 'path'
import fs from 'fs'
import zlib from 'zlib'
import { exporters } from './exporters/index.js'
import { transform } from './utils.js'

import createDebug from 'debug'
const debug = createDebug('feathers-import-export:export')

// Helper function that write a buffer to a stream with gzip compression or not
async function _writeBuffer (stream, buffer, gzip) {
  if (!buffer) return
  if (gzip) {
    await new Promise((resolve, reject) => {
      zlib.gzip(buffer, (error, gzippedBuffer) => { 
        if (error) reject(error)
        stream.write(gzippedBuffer)
        resolve()
      })
    })
  } else {
    stream.write(buffer)
  }
}

// Helper function to write the queried data from the service 
async function _writeData (stream, options) {
  // retrive the exporter
  const exporter = exporters[options.format]
  if (!exporter) throw new Error(`export: format ${options.format} not supported`)
  // count the objects to export
  let response = await options.service.find({ query: Object.assign(options.query, { $limit: 0 }) })
  let info = {
    totalChunks: Math.ceil(response.total / options.chunkSize),    
    currentChunk: 0,
    objectCount: 0,
    contentType: options.gzip ? 'application/gzip' : exporter.type()
  }
  // initialize the export
  debug(`Initializing the export of ${response.total} objects in ${info.totalChunks} chunks of size of ${options.chunkSize} objects`)
  await _writeBuffer(stream, exporter.begin(info), options.gzip)
  // write the data chunk by chunk
  while (info.currentChunk < info.totalChunks) {
    const offset = info.currentChunk * options.chunkSize
    debug(`Querying service from ${offset} with a limit of ${options.chunkSize}`)
    response = await options.service.find({ 
      query: Object.assign(options.query, { $limit: options.chunkSize, $skip: offset }),
      paginate: { default: options.chunkSize, max: options.chunkSize }
    })
    let chunk = _.get(response, options.chunkPath)
    if (chunk) {
      info.objectCount += _.size(chunk)
      if (options.transform) {
        if (typeof options.transform === 'function') chunk = await options.transform(chunk, options)
        else chunk = transform(chunk, options.transform)
      }
      debug(`Writing ${_.size(chunk)} objects`)
      await _writeBuffer(stream, exporter.process(info, chunk), options.gzip)
    }
    info.currentChunk++
  }
  // finalize the export
  debug(`Finalizing the export`)
  await _writeBuffer(stream, exporter.end(info), options.gzip)
  stream.end()
  return info
}

export async function _export (options) {
  debug(`Export file with options ${JSON.stringify(_.omit(options, 's3Service'), null, 2)}`)
  // create a write stream on a tmp file named with the uuid
  const tmpFile = path.join(options.workingDir, options.uuid)
  let tmpStream = fs.createWriteStream(tmpFile)
  // export the data
  const writeResult = await _writeData(tmpStream, options)
  // wait for a lapse of time
  debug(`Waiting for a lapse of time before uploading exported file`)
  await new Promise(resolve => setTimeout(resolve, 1000))
  // upload the generated file
  debug(`Uploading tmp file ${options.uuid}`)
  let response = await options.s3Service.uploadFile({ 
    filePath: tmpFile, 
    contentType: writeResult.contentType
  })
  debug(`Uploaded done with id ${response.id}`)
  if (options.signedUrl) {
    response = await options.s3Service.create({
      command: 'GetObject',
      id: response[options.s3Service.id],
      expiresIn: options.expiresIn,
      ResponseContentDisposition: `attachment; filename="${options.filename}"`
    })
    debug(`Signed url created: ${response.SignedUrl}`)
  }
  // remove tmp file
  fs.unlinkSync(tmpFile)
  debug(`Removed tmp file ${tmpFile}`)
  Object.assign(response, { uuid: options.uuid, chunks: writeResult.totalChunks, objects: writeResult.objectCount })
  return response
}