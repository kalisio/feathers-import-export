import _ from 'lodash'
import path from 'path'
import fs from 'fs'
import { PassThrough } from 'stream'
import { exporters } from './exporters/index.js'
import { transform } from './utils.js'
import Archiver from "archiver"

import createDebug from 'debug'
const debug = createDebug('feathers-import-export:export')

// Helper function that return the archiver according the requested archive
function getArchiver (archive) {
  if (archive === 'zip') return new Archiver('zip', { zlib: { level: 9 } })
  if (archive === 'tgz') return new Archiver('tar', { gzip: true })
  throw new Error(`archive of type of ${archive} is not supported`)
}

// Helper function that return the content type according the requested archive
function getArchiveContentType (archive) {
  if (archive === 'zip') return 'application/zip'
  if (archive === 'tgz') return 'application/x-gtar'
}

// Helper function that write a buffer to a stream with compression or not
async function _writeBuffer (stream, buffer, archiverStream) {
  if (!buffer) return
  if (archiverStream) archiverStream.write(buffer)
  else stream.write(buffer)
}

// Helper function to write the queried data from the service 
async function _writeData (stream, data) {
  // retrieve the exporter
  const exporter = exporters[data.format]
  if (!exporter) throw new Error(`export: format ${data.format} not supported`)
  // setup the archiver if needed
  let archiver, archiverStream
  if (data.archive) {
    archiver = getArchiver(data.archive)
    archiver.pipe(stream)
    archiverStream = new PassThrough()
    archiver.append(archiverStream, { name: data.filename })    
  }
  // count the objects to export
  let response = await data.service.find({ query: Object.assign(data.query, { $limit: 0 }) })
  let info = {
    totalChunks: Math.ceil(response.total / data.chunkSize),    
    currentChunk: 0,
    objectCount: 0,
    contentType: data.archive ? getArchiveContentType(data.archive) : exporter.type()
  }
  if (info.totalChunks === 0) return info
  // initialize the export
  debug(`Initializing the export of ${response.total} objects in ${info.totalChunks} chunks of size of ${data.chunkSize} objects`)
  await _writeBuffer(data.archive ? archiverStream : stream, exporter.begin(info))
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
      await _writeBuffer(data.archive ? archiverStream : stream, exporter.process(info, chunk))
    }
    info.currentChunk++
  }
  // finalize the export
  debug(`Finalizing the export`)
  await _writeBuffer(data.archive ? archiverStream : stream, exporter.end(info))
  if (archiverStream) {
    archiverStream.end()
    await new Promise((resolve, reject) => {
      stream.on('close', resolve)
      archiver.on('error', reject)
      archiver.finalize()
    })
  } else stream.end()
  return info
}

export async function _export (data) {
  debug(`Export file with data ${JSON.stringify(_.omit(data, 's3Service'), null, 2)}`)
  // create a write stream on a tmp file named with the uuid
  const tmpFile = path.join(data.workingDir, data.uuid)
  let tmpStream = fs.createWriteStream(tmpFile)
  // export the data
  const writeResult = await _writeData(tmpStream, data)
  if (writeResult.totalChunks === 0) return { uuid: data.uuid, chunks: 0, objects: 0 }
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
  // compute the filename according archive options
  let filename = data.filename
  if (data.archive) filename = `${filename}.${data.archive}`
  // create the signedUrl to the uploaded file if needed
  if (data.signedUrl) {
    response = await data.s3Service.create({
      command: 'GetObject',
      id: response[data.s3Service.id],
      expiresIn: data.expiresIn,
      ResponseContentDisposition: `attachment; filename="${filename}"`
    })
    debug(`Signed url created: ${response.SignedUrl}`)
  }
  // remove tmp file
  fs.unlinkSync(tmpFile)
  debug(`Removed tmp file ${tmpFile}`)
  // return the response with additional data
  return Object.assign(response, { 
    uuid: data.uuid, 
    chunks: writeResult.totalChunks, 
    objects: writeResult.objectCount,
    filename
  })
}