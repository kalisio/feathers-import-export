import feathers from '@feathersjs/feathers'
import express from '@feathersjs/express'
import { Service as S3Service } from '@kalisio/feathers-s3'
import chai, { util, expect } from 'chai'
import chailint from 'chai-lint'
import { Service } from '../lib/index.js'
import { createMongoService, removeMongoService } from './utils.mongodb.js'
import { getTmpPath, unzipDataset, clearDataset } from './utils.dataset.js'
import makeDebug from 'debug'

feathers.setDebug(makeDebug)

let app, s3Service, importService, expressServer, id

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
    name: 'json',
    mimeType: 'application/json',
    service: 'objects',
    total: 36273
  },
  {
    name: 'geojson',
    mimeType: 'application/geo+json',
    service: 'features',
    total: 255
  },
  {
    name: 'csv',
    mimeType: 'text/csv',
    service: 'records',
    total: 500000
  }
]

function getDataset (scenario) {
  return `${scenario.service}.${scenario.name}`
}

function runTests (scenario) {
  it(`[${scenario.name}] unzip dataset`, async () => {
    await unzipDataset(getDataset(scenario))
  })
  it(`[${scenario.name}] upload dataset`, async () => {
    const response = await s3Service.uploadFile({
      filePath: getTmpPath(getDataset(scenario)),
      mimeType: scenario.mimeType
    })
    id = response.id
  })
  it(`[${scenario.name}] import dataset`, async () => {
    // TODO
    await importService.import({ id, service: scenario.service })
  })
    .timeout(60000)
  it(`[${scenario.name}] check collection`, async () => {
    const service = app.service(scenario.service)
    const response = await service.find()
    expect(response.total).to.equal(scenario.total)
  })
  it(`[${scenario.name}] remove dataset`, async () => {
    const response = await s3Service.remove(id)
    expect(response.$metadata.httpStatusCode).to.equal(204)
    clearDataset(getDataset(scenario))
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
    for (const scenario of scenarios) {
      app.use(scenario.service, await createMongoService(scenario.service))
      expect(app.service(scenario.service)).toExist()
    }
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

  // run the scenarios
  for (const scenario of scenarios) runTests(scenario)

  after(async () => {
    for (const scenario of scenarios) await removeMongoService(scenario.service)
    await expressServer.close()
  })
})
