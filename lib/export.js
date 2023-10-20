import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { exporters } from './exporters/index.js'
import createDebug from 'debug'
const debug = createDebug('feathers-import-export:export')

// Helper function that write a buffer to a stream with gzip compression or not
function write (stream, buffer, gzip) {
  if (buffer) {
    if (gzip) {
      zlib.gzip(buffer, (error, gzippedBuffer) => { 
        if (!error) stream.write(gzippedBuffer)
        else console.error(error) // TODO
      })
    } else {
      stream.write(buffer)
    }
  }
}

export async function _export (options) {
  debug(`Export file with options ${JSON.stringify(options, null, 2)}`)
  // retrieve the exporter
  const exporter = exporters[options.format]
  if (!exporter) throw new Error(`export: format ${options.format} not supported`)
  // define ouputfile and the corresonding stream
  let tmpFile = path.join(options.workingDir, options.filename)
  let outputSteam = fs.createWriteStream(tmpFile)
  // setup the process info object
  let response = await options.service.find({ query: Object.assign(options.query, { $limit: 0 }) })
  const info = {
    currentChunk: 0,
    totalChunks: Math.ceil(response.total / options.chunkSize)
  }
  debug(`Exporting ${response.total} objects in ${info.totalChunks} chunks of size of ${options.chunkSize} objects`)
  // begin the process
  write(outputSteam, exporter.begin(info), options.gzip)
  // process chunks
  while (info.currentChunk < info.totalChunks) {
    response = await options.service.find({ query: Object.assign(options.query, { $limit: options.chunkSize, $skip: info.currentChunk * info.chunkSize }) })
    write(outputSteam, exporter.process(info, response.data), options.gzip)
    info.currentChunk++
  }
  // end the process
  write(outputSteam, exporter.end(info), options.gzip)
  // upload the generated file
  response = await options.s3Service.uploadFile({ 
    filePath: tmpFile, 
    mimeType: options.gzip ? 'application/gzip' : exporter.type()
  })
  debug(`Uploaded temporary file ${tmpFile} with key ${response.id}`)
  return response
}