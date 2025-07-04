
import _ from 'lodash'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { BadRequest } from '@feathersjs/errors'
import { Service as S3Service } from '@kalisio/feathers-s3'
import { _import } from './import.js'
import { _export } from './export.js'

export class Service {
  constructor (options) {
    // check params
    if (!options) throw new Error('constructor: \'options\' param must be provided')
    // setup app
    if (!options.app) throw new Error('constructor: \'options.app\' param must be provided')
    this.app = options.app
    // setup s3 service
    if (!options.s3Options) throw new Error('constructor: \'options.s3Options\' param must be provided')
    this.s3ServicePath = crypto.randomUUID() // create a unique path
    this.app.use(this.s3ServicePath, new S3Service(options.s3Options), {
      methods: ['getObjectCommand', 'uploadFile']
    })
    this.s3Service = this.app.service(this.s3ServicePath)
    // setup working dir
    this.workingDir = options.workingDir || '/tmp'
    if (!fs.existsSync(this.workingDir)){
      fs.mkdirSync(this.workingDir)
    }
    // setup transforms
    this.transforms = {}
  }

  registerTransform (key, transform) {
    this.transforms[key] = transform
  }

  getCustomEventHook (data, params) {
    return {
      path: _.findKey(this.app.services, service => service === this),
      service: this,
      app: this.app,
      result: data,
      params
    }
  }

  async create (data, params) {
    if (!data.method) throw new BadRequest('create: missing \'data.action\'')
    switch (data.method) {
      case 'import': 
        return this.import(data, params)
      case 'export': 
        return this.export(data, params)
      default:
        throw new BadRequest(`create: invalid action ${data.action}`)
    }
  }

  async import (data, params) {
    // check the required id
    if (!data.id) throw new Error('import: missing \'data.id\'')
    // retrieve the targeted service
    if (!data.servicePath) throw new Error('import: missing \'data.servicePath\'')
    const service = this.app.service(data.servicePath)
    if (!service) throw new Error('import: service with path \'data.servicePath\' not found')
    // retrieve the transformation
    let transform = data.transform
    if (transform && typeof data.transform === 'string') transform = this.transforms[transform]
    // create a unique id
    const uuid = crypto.randomUUID()
    // call the import implementation method
    const payload = { uuid }
    if (this.emit) this.emit('import-created', payload, this.getCustomEventHook(payload, params))
    const response = await _import(_.defaults({
      uuid,
      id: data.id,
      service,
      transform,
      s3Service: this.s3Service,
      app: this.app
    }, data))
    if (this.emit) this.emit('import-completed', response, this.getCustomEventHook(response, params))
    return response
  }

  async export (data, params) {
    // retrieve the targeted service
    if (!data.servicePath) throw new Error('export: missing \'data.servicePath\'')
    const service = this.app.service(data.servicePath)
    if (!service) throw new Error('export: service with path \'data.servicePath\' not found')
    // retrieve the transformation
    let transform = data.transform
    if (transform && typeof transform === 'string') transform = this.transforms[transform]
    // compute the filename if needed
    const format = _.get(data, 'format', 'json')
    let filename = data.filename
    if (!filename) filename = `${path.basename(data.servicePath)}.${format}`
    // create a unique id and 
    const uuid = crypto.randomUUID()
    // call the export implementation method
    const payload = { uuid }
    if (this.emit) this.emit('export-created', payload, this.getCustomEventHook(payload, params))
    const response = await _export(_.defaults({
      uuid,
      filename,
      service,
      query: _.get(data, 'query', {}),
      chunkPath: _.get(data, 'chunkPath', 'data'),
      chunkSize: _.get(data, 'chunkSize', 500),
      transform,
      format,
      archive: data.archive,
      signedUrl: _.get(data, 'signedUrl', true),
      expiresIn: _.get(data, 'expiresIn', 180),
      workingDir: this.workingDir,      
      s3Service: this.s3Service,
      app: this.app
    }, data))
    if (this.emit) this.emit('export-completed', response, this.getCustomEventHook(response, params))
    return response
  }
}
