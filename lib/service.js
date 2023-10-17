import _ from 'lodash'
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import createDebug from 'debug'
import { BadRequest } from '@feathersjs/errors'
import { JSONExporter, CSVExporter, GEOJSONExporter } from './exporters/index.js'

const debug = createDebug('feathers-import-export:service')

/*
 Helper function that write a buffer to a stream with zip compression or not
 */
 function write (stream, buffer, zip) {
  if (buffer) {
    if (zip) {
      zlib.gzip(buffer, (error, zippedBuffer) => { 
        if (!error) stream.write(zippedBuffer)
        else console.error(error)
      })
    } else {
      stream.write(buffer)
    }
  }
}

export class Service {
  constructor (options, app) {
    // check params
    if (!options) throw new Error('constructor: \'options\' param must be provide')
    if (!app) throw new Error('constructor: \'app\' param must be provide')
    // setup app
    this.app = app
    // setup s3 service
    const s3ServiceName = options.s3Service || 's3'
    this.s3Service = app.service(s3ServiceName)
    if (!this.s3Service) throw new Error('constructor: \'s3Service\' not found')
    // setup working dir
    this.workingDir = options.workingDir || '/tmp'
    // register default exporters
    this.exporters = {
      'json': JSONExporter,
      'csv': CSVExporter,
      'geojson': GEOJSONExporter
    },
    // register default importers
    this.importers ={
      // TODO
    }
  }

  registerExporter (format, exporter) {
    this.exporters[format] = exporter
  }

  async create (data, params) {
    if (!data.action) throw new BadRequest('create: missing \'data.action\' parameter')
    switch (data.action) {
      case 'import': 
        return this.import(data, params)
      case 'export': 
        return this.export(data, params)
      default:
        throw new BadRequest(`create: invalid action ${data.action}`)
    }
  }

  async import (data, params) {
    // TODO
  }

  async export (data, params) {
    // retrieve export options
    const { service: serviceName } = data
    const query = data.query || {}
    const format = data.format || 'json'
    const chunkSize = data.chunkSize || 1000
    const expiresIn = data.expiresIn || 300
    const exporter = _.get(this.exporters, format)
    if (!exporter) throw new Error(`export: invalid format ${format}`)
    const zip = _.get(data, 'zip', false)
    // retrieve the service to be requested
    const service = this.app.service(serviceName)
    if (!service) throw new Error(`export: cannot get service ${serviceName} with context ${serviceContext}`)
    // define ouputfile and the corresonding stream
    let outputFile = path.join(this.workingDir, `${serviceName}.${format}`)
    if (zip) outputFile += '.gz'
    let outputSteam = fs.createWriteStream(outputFile)
    // setup the process info object
    let response = await service.find({ query: Object.assign(query, { $limit: 0 }) })
    const info = {
      currentChunk: 0,
      chunkSize,
      totalChunks: Math.ceil(response.total / chunkSize)
    }
    debug(`Exporting ${response.total} objects in ${info.totalChunks} chunks of size of ${chunkSize} objects`)
    // begin the process
    write(outputSteam, exporter.begin(info), zip)
    // process chunks
    while (info.currentChunk < info.totalChunks) {
      response = await service._find({ query: Object.assign(query, { $limit: chunkSize, $skip: info.currentChunk * info.chunkSize }) })
      write(outputSteam, exporter.process(info, response.data), zip)
      info.currentChunk++
    }
    // end the process
    write(outputSteam, exporter.end(info), zip)
    // upload the generated file
    response = await this.s3Service.uploadFile({ filePath: outputFile, mimeType: zip ? 'application/gzip' : exporter.type()})
    // create the signed url
    return this.s3Service.create({ id: response.id, command: 'GetObject', expiresIn })
  }
}
