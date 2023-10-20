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

let app; let s3Service; let service; let expressServer; let id; let keys = []

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
  bucket: process.env.S3_BUCKET
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
    total: 100000
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
      mimeType: scenario.mimeType,
      chunkSize: 1024 * 1024 * 20
    })
    expect(response.id).toExist()
    id = response.id
  })
    .timeout(60000)
  it(`[${scenario.name}] import dataset`, async () => {
    // TODO
    await service.create({
      method: 'import',
      id,
      service: scenario.service
    })
  })
    .timeout(300000)
  it(`[${scenario.name}] check collection`, async () => {
    const service = app.service(scenario.service)
    const response = await service.find()
    expect(response.total).to.equal(scenario.total)
  })
  it(`[${scenario.name}] export collection`, async () => {
    const response = await service.create({
      method: 'export',
      service: scenario.service,
      query: scenario.query,
      format: scenario.name
    })
    expect(response.id).toExist()
    keys.push(response.id)
  })
    .timeout(60000)
  it(`[${scenario.name}] export collection (no compression)`, async () => {
    const response = await service.create({
      method: 'export',
      service: scenario.service,
      query: scenario.query,
      format: scenario.name,
      gzip: false
    })
    expect(response.id).toExist()
    keys.push(response.id)
  })
    .timeout(60000)
  it(`[${scenario.name}] list exported files`, async () => {
    const response = await s3Service.find()
    expect(response.length).to.equal(keys.length)
  })
  it(`[${scenario.name}] clean`, async () => {
    for (const key of keys) {
      const response = await s3Service.remove(key)
      expect(response.$metadata.httpStatusCode).to.equal(204)
    }
    keys = []
    clearDataset(getDataset(scenario))
  })
}

describe('feathers-import-export', () => {
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
    // create s3 service
    app.use('s3', new S3Service(s3Options), {
      methods: ['create', 'uploadFile']
    })
    s3Service = app.service('s3')
    expect(s3Service).toExist()
    // create import-export service
    app.use('import', new Service(exportOptions, app))
    service = app.service('import')
    expect(service).toExist()
    expressServer = await app.listen(3333)
  })

  // run the scenarios
  for (const scenario of scenarios) runTests(scenario)

  after(async () => {
    for (const scenario of scenarios) await removeMongoService(scenario.service)
    await expressServer.close()
  })
})
