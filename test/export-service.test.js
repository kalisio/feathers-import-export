import fs from 'fs'
import feathers from '@feathersjs/feathers'
import express from '@feathersjs/express'
import { Service as S3Service } from '@kalisio/feathers-s3'
import chai, { util, expect } from 'chai'
import chailint from 'chai-lint'
import { Service } from '../lib/index.js'
import { createMongoService, removeMongoService } from './utils.mongodb.js'
import { getTmpPath, unzipDataset } from './utils.dataset.js'
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

const scenarios = [
  {
    service: 'objects',
    format: 'json',
    query: '{ $and: [{ year: { $gte: 1970 } }, { year: { $lt: 1980 } }] }'
  },
  {
    service: 'features',
    format: 'geojson'
  },
  {
    service: 'records',
    foramt: 'csv'
  }
]

function getDataset (scenario) {
  return `${scenario.service}.${scenario.format}`
}

function runTests (scenario) {
  it(`unzip archive ${scenario.service}`, async () => {
    await unzipDataset(getDataset(scenario))
  })
  it('fill the mongodb collection', async () => {
    const datasetPath = getTmpPath(getDataset(scenario))
    const dataset = JSON.parse(fs.readFileSync(datasetPath))
    const service = app.service(scenario.service)
    let response = await service.create(dataset)
    response = await service.find({ query: { $limit: 0 } })
    expect(response.total).toExist()
    /* expect(response.length).to.equal(36273)
    response = await mongoService.find({ query: { $limit: 0 } })
    expect(response.total).to.equal(36273)
    */
  })
  /* it('export objects collection in JSON using query:' + JSON.stringify(query, null, 2), async () => {
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
    .timeout(60000) */
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
    // create mongo services
    for (const scenario of scenarios) {
      app.use(scenario.service, await createMongoService(scenario.service))
      expect(app.service(scenario.service)).toExist()
    }
    // create the s3 service
    app.use('s3', new S3Service(s3Options), {
      methods: ['create', 'uploadFile']
    })
    // create the export service
    app.use('export', new Service(exportOptions, app))
    exportService = app.service('export')
    expect(exportService).toExist()
    expressServer = await app.listen(3333)
  })

  // run the scenarios
  for (const scenario of scenarios) runTests(scenario)

  after(async () => {
    for (const scenario of scenarios) await removeMongoService(scenario.service)
    await expressServer.close()
  })
})
