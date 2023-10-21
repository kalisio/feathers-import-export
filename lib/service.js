
import _ from 'lodash'
import { BadRequest } from '@feathersjs/errors'
import { _import } from './import.js'
import { _export } from './export.js'

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
    // check the data paylod
    if (!data.id) throw new Error('import: missing \'data.id\'')
    if (!data.service) throw new Error('import: missing \'data.service\'')
    const service = this.app.service(data.service)
    if (!service) throw new Error('import: service \'data.service\' not found')
    // call the import implementation method
    return _import({
      id: data.id,
      service,
      s3Service: this.s3Service
    })
  }

  async export (data, params) {
    if (!data.service) throw new Error('export: missing \'data.service\'')
    const service = this.app.service(data.service)
    if (!service) throw new Error('export: service \'data.service\' not found')
    // call the export implementation method
    const format = _.get(data, 'format', 'json')
    const gzip = _.get(data, 'gzip', true)
    let filename = data.fileName || `${data.service}.${format}`
    if (gzip) filename+='.gz'
    return _export({
      filename,
      service,
      query: _.get(data, 'query', {}),
      format,
      gzip,
      chunkSize: _.get(data, 'chunkSize', 500),
      expiresIn: _.get(data, 'expiresIn', 180),
      s3Service: this.s3Service,
      workingDir: this.workingDir
    })
  }
}
