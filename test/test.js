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

let app
let s3Service
let service
let expressServer
let inputId
let outputIds = []

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
    query: { $and: [{ year: { $gte: 1970 } }, { year: { $lt: 2000 } }] },
    documents: 36273,
    sizes: [63093, 488956]
  },
  {
    name: 'geojson',
    mimeType: 'application/geo+json',
    service: 'features',
    chunkSize: 100,
    documents: 255,
    sizes: [57, 7213573]
  },
  {
    name: 'csv',
    mimeType: 'text/csv',
    service: 'records',
    documents: 100000,
    sizes: [378873, 804177]
  }
]

function getDataset (scenario) {
  return `${scenario.service}.${scenario.name}`
}

function runTests (scenario) {
  it(`[${scenario.name}] unzip input dataset`, async () => {
    await unzipDataset(getDataset(scenario))
  })
  it(`[${scenario.name}] upload input dataset`, async () => {
    const response = await s3Service.uploadFile({
      filePath: getTmpPath(getDataset(scenario)),
      mimeType: scenario.mimeType,
      chunkSize: 1024 * 1024 * 10
    })
    expect(response.id).toExist()
    inputId = response.id
  })
    .timeout(120000)
  it(`[${scenario.name}] import input dataset`, async () => {
    // TODO
    await service.create({
      method: 'import',
      id: inputId,
      service: scenario.service
    })
  })
    .timeout(60000)
  it(`[${scenario.name}] check imported collection`, async () => {
    const service = app.service(scenario.service)
    const response = await service.find()
    expect(response.total).to.equal(scenario.documents)
  })
  it(`[${scenario.name}] clean input dataset`, async () => {
    const response = await s3Service.remove(inputId)
    expect(response.$metadata.httpStatusCode).to.equal(204)
    clearDataset(getDataset(scenario))
  })
  it(`[${scenario.name}] export collection`, async () => {
    const response = await service.create({
      method: 'export',
      service: scenario.service,
      query: scenario.query,
      format: scenario.name,
      chunkSize: scenario.chunkSize
    })
    expect(response.id).toExist()
    outputIds.push(response.id)
  })
    .timeout(180000)
  it(`[${scenario.name}] export collection without gzip compression`, async () => {
    const response = await service.create({
      method: 'export',
      service: scenario.service,
      query: scenario.query,
      format: scenario.name,
      chunkSize: scenario.chunkSize,
      gzip: false
    })
    expect(response.id).toExist()
    outputIds.push(response.id)
  })
    .timeout(180000)
  it(`[${scenario.name}] list output files`, async () => {
    const response = await s3Service.find()
    expect(response.length).to.equal(outputIds.length)
  })
  it(`[${scenario.name}] download output files`, async () => {
    for (let i = 0; i < 2; i++) {
      const response = await s3Service.downloadFile({ id: outputIds[i], filePath: getTmpPath(outputIds[i]) })
      expect(response.id).toExist()
    }
  })
  it(`[${scenario.name}] clean output files`, async () => {
    for (let i = 0; i < 2; i++) {
      const response = await s3Service.remove(outputIds[i])
      expect(response.$metadata.httpStatusCode).to.equal(204)
      clearDataset(outputIds[i])
    }
    outputIds = []
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
      methods: ['uploadFile', 'downloadFile']
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
