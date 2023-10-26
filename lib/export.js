import _ from 'lodash'
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { exporters } from './exporters/index.js'
import { transform } from './utils.js'

import createDebug from 'debug'
const debug = createDebug('feathers-import-export:export')

// Helper function that write a buffer to a stream with gzip compression or not
async function write (stream, buffer, gzip) {
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

export async function _export (options) {
  debug(`Export file with options ${JSON.stringify(options, null, 2)}`)
  // retrieve the exporter
  const exporter = exporters[options.format]
  if (!exporter) throw new Error(`export: format ${options.format} not supported`)
  // define ouputfile and the corresonding stream
  let tmpFile = path.join(options.workingDir, options.filename)
  let outputSteam = fs.createWriteStream(tmpFile)
  debug(`Created tmp file ${tmpFile}`)
  // setup the process info object
  let response = await options.service.find({ query: Object.assign(options.query, { $limit: 0 }) })
  const info = {
    currentChunk: 0,
    totalChunks: Math.ceil(response.total / options.chunkSize)
  }
  // begin the process  
  debug(`Beginning the export of ${response.total} objects in ${info.totalChunks} chunks of size of ${options.chunkSize} objects`)
  await write(outputSteam, exporter.begin(info), options.gzip)
  // process chunks
  while (info.currentChunk < info.totalChunks) {
    const offset = info.currentChunk * options.chunkSize
    debug(`Querying service from ${offset} with a limit of ${options.chunkSize}`)
    response = await options.service.find({ 
      query: Object.assign(options.query, { $limit: options.chunkSize, $skip: offset }) 
    })
    if (options.transform) {
      debug(`Transforming chunk with ${JSON.stringify(options.transform, null, 2)}`)
      response.data = transform(response.data, options.transform)
    }
    debug(`Writing ${_.size(response.data)} objects`)
    await write(outputSteam, exporter.process(info, response.data), options.gzip)
    info.currentChunk++
  }
  // end the process
  debug(`Ending the export`)
  await write(outputSteam, exporter.end(info), options.gzip)
  outputSteam.end()
  // wait for a lapse of time
  debug(`Waiting for a lapse of time before uploading exported file`)
  await new Promise(resolve => setTimeout(resolve, 1000))
  // upload the generated file
  debug(`Uploading texport exported file ${tmpFile}`)
  response = await options.s3Service.uploadFile({ 
    filePath: tmpFile, 
    mimeType: options.gzip ? 'application/gzip' : exporter.type()
  })
  debug(`Uploaded done with id ${response.id}`)
  if (options.signedUrl) {
    response = await options.s3Service.create({
      command: 'GetObject',
      id: response[options.s3Service.id],
      expiresIn: options.expiresIn
    })
    debug(`Signed url created: ${response.SignedUrl}`)
  }
  // remove output file
  fs.unlinkSync(tmpFile)
  debug(`Removed tmp file ${tmpFile}`)
  return response
}