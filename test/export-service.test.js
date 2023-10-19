import fs from 'fs'
import feathers from '@feathersjs/feathers'
import express from '@feathersjs/express'
import { Service as S3Service } from '@kalisio/feathers-s3'
import chai, { util, expect } from 'chai'
import chailint from 'chai-lint'
import { Service } from '../lib/index.js'
import { createMongoService, removeMongoService } from './mongo-service.js'
import makeDebug from 'debug'

feathers.setDebug(makeDebug)

let app, mongoService, s3Service, exportService, expressServer

const s3Options = {
  s3Client: {
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
    },
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    signatureVersion: 'v4'
  },
  bucket: process.env.S3_BUCKET,
  prefix: 'export'
}

const exportOptions = {
  s3Service: 's3',
  workingDir: './test/tmp'
}

function runTests (query = {}) {
  it('export objects collection in JSON using query:' + JSON.stringify(query, null, 2), async () => {
    const response = await exportService.create({
      method: 'export',
      service: 'objects',
      query
    })
    expect(response.id).toExist()
  })
    .timeout(60000)
  it('export objects collection in CSV using query:' + JSON.stringify(query, null, 2), async () => {
    const response = await exportService.create({
      method: 'export',
      service: 'objects',
      query,
      format: 'csv'
    })
    expect(response.id).toExist()
  })
    .timeout(60000)
  it('export objects collection in zippped JSON using query:' + JSON.stringify(query, null, 2), async () => {
    const response = await exportService.create({
      method: 'export',
      service: 'objects',
      query,
      zip: true
    })
    expect(response.id).toExist()
  })
    .timeout(60000)
  it('export objects collection in zipped CSV using query:' + JSON.stringify(query, null, 2), async () => {
    const response = await exportService.create({
      method: 'export',
      service: 'objects',
      query,
      format: 'csv',
      zip: true
    })
    expect(response.id).toExist()
  })
    .timeout(60000)
}

describe('feathers-export-service', () => {
  before(() => {
    chailint(chai, util)
    app = express(feathers())
    app.use(express.json())
    app.configure(express.rest())
  })

  it('is ES module compatible', () => {
    expect(typeof Service).to.equal('function')
  })

  it('create the services', async () => {
    // create a dummy service
    app.use('objects', await createMongoService('objects'))
    mongoService = app.service('objects')
    expect(mongoService).toExist()
    // create the s3 service
    app.use('s3', new S3Service(s3Options), {
      methods: ['create', 'uploadFile']
    })
    s3Service = app.service('s3')
    expect(s3Service).toExist()
    // create the export service
    app.use('export', new Service(exportOptions, app))
    exportService = app.service('export')
    expect(exportService).toExist()
    expressServer = await app.listen(3333)
  })

  it('fill the objects collection', async () => {
    const objects = JSON.parse(fs.readFileSync('./test/data/objects.json'))
    let response = await mongoService.create(objects)
    expect(response.length).to.equal(36273)
    response = await mongoService.find({ query: { $limit: 0 } })
    expect(response.total).to.equal(36273)
  })

  runTests({})
  runTests({ $and: [ { year: {$gte: 1970 } }, { year: { $lt: 1980 }} ] })

  after(async () => {
    await removeMongoService('objects')
    await expressServer.close()
  })
})
