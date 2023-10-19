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

let app, objectsService, recordsService, featuresService,
    s3Service, importService, expressServer, id

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
  prefix: 'import'
}

const exportOptions = {
  s3Service: 's3',
  workingDir: './test/tmp'
}

const scenarios = [
  { 
    filePath: './test/data/objects.json' ,
    mimeType: 'application/json',
    service: 'objects'
  },
  { 
    filePath: './test/data/features.geojson' ,
    mimeType: 'application/geo+json',
    service: 'features'
  },
  {
    filePath: './test/data/records.csv' ,
    mimeType: 'text/csv',
    service: 'records'
  }
]


function runTests (scenario) {
  it(`upload file ${scenario.filePath}`, async () => {
    const response = await s3Service.uploadFile({ filePath: scenario.filePath, mimeType: scenario.mimeType })
    id = response.id
  })
  it(`import file ${scenario.filePath}`, async () => {
    const response = await importService.import({ id, service: scenario.service })
  })
}

describe('feathers-import-service', () => {
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
    // create mongo services
    app.use('objects', await createMongoService('objects'))
    objectsService = app.service('objects')
    expect(objectsService).toExist()
    app.use('records', await createMongoService('records'))
    recordsService = app.service('records')
    expect(recordsService).toExist()
    app.use('features', await createMongoService('features'))
    featuresService = app.service('features')
    expect(featuresService).toExist()
    // create the s3 service
    app.use('s3', new S3Service(s3Options), {
      methods: ['create', 'uploadFile']
    })
    s3Service = app.service('s3')
    expect(s3Service).toExist()
    // create the export service
    app.use('import', new Service(exportOptions, app))
    importService = app.service('import')
    expect(importService).toExist()
    expressServer = await app.listen(3333)
  })

  runTests(scenarios[0])
  runTests(scenarios[1])

  after(async () => {
    await removeMongoService('objects')
    await removeMongoService('records')
    await removeMongoService('features')
    await expressServer.close()
  })
})
