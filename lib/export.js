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
async function _writeData (stream, data) {
  // retrieve the exporter
  const exporter = exporters[data.format]
  if (!exporter) throw new Error(`export: format ${data.format} not supported`)
  // count the objects to export
  let response = await data.service.find({ query: Object.assign(data.query, { $limit: 0 }) })
  let info = {
    totalChunks: Math.ceil(response.total / data.chunkSize),    
    currentChunk: 0,
    objectCount: 0,
    contentType: data.gzip ? 'application/gzip' : exporter.type()
  }
  if (info.totalChunks === 0) return info
  // initialize the export
  debug(`Initializing the export of ${response.total} objects in ${info.totalChunks} chunks of size of ${data.chunkSize} objects`)
  await _writeBuffer(stream, exporter.begin(info), data.gzip)
  // write the data chunk by chunk
  while (info.currentChunk < info.totalChunks) {
    const offset = info.currentChunk * data.chunkSize
    debug(`Querying service from ${offset} with a limit of ${data.chunkSize}`)
    response = await data.service.find({ 
      query: Object.assign(data.query, { $limit: data.chunkSize, $skip: offset }),
      paginate: { default: data.chunkSize, max: data.chunkSize }
    })
    let chunk = _.get(response, data.chunkPath)
    if (chunk) {
      info.objectCount += _.size(chunk)
      if (data.transform) {
        if (typeof data.transform === 'function') chunk = await data.transform(chunk, data)
        else chunk = transform(chunk, data.transform)
      }
      debug(`Writing ${_.size(chunk)} objects`)
      await _writeBuffer(stream, exporter.process(info, chunk), data.gzip)
    }
    info.currentChunk++
  }
  // finalize the export
  debug(`Finalizing the export`)
  await _writeBuffer(stream, exporter.end(info), data.gzip)
  stream.end()
  return info
}

export async function _export (data) {
  debug(`Export file with data ${JSON.stringify(_.omit(data, 's3Service'), null, 2)}`)
  // create a write stream on a tmp file named with the uuid
  const tmpFile = path.join(data.workingDir, data.uuid)
  let tmpStream = fs.createWriteStream(tmpFile)
  // export the data
  const writeResult = await _writeData(tmpStream, data)
  if (writeResult.totalChunks === 0) return { chunks: writeResult.totalChunks, objects: writeResult.objectCount }
  // wait for a lapse of time
  debug(`Waiting for a lapse of time before uploading exported file`)
  await new Promise(resolve => setTimeout(resolve, 1000))
  // upload the generated file
  debug(`Uploading tmp file ${data.uuid}`)
  let response = await data.s3Service.uploadFile({ 
    filePath: tmpFile, 
    contentType: writeResult.contentType,
    context: data
  })
  debug(`Uploaded done with id ${response.id}`)
  if (data.signedUrl) {
    response = await data.s3Service.create({
      command: 'GetObject',
      id: response[data.s3Service.id],
      expiresIn: data.expiresIn,
      ResponseContentDisposition: `attachment; filename="${data.filename}"`
    })
    debug(`Signed url created: ${response.SignedUrl}`)
  }
  // remove tmp file
  fs.unlinkSync(tmpFile)
  debug(`Removed tmp file ${tmpFile}`)
  return Object.assign(response, { uuid: data.uuid, chunks: writeResult.totalChunks, objects: writeResult.objectCount })
}