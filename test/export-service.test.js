import fs from 'fs'
import { promisify } from 'util'
import { pipeline } from 'stream'
import feathers from '@feathersjs/feathers'
import express from '@feathersjs/express'
import { Service as S3Service } from '@kalisio/feathers-s3'
import chai, { util, expect } from 'chai'
import chailint from 'chai-lint'
import { Service } from '../lib/index.js'
import { createMongoService, removeMongoService, WriteMongoService } from './utils.mongodb.js'
import { getTmpPath, unzipDataset } from './utils.dataset.js'
import makeDebug from 'debug'

feathers.setDebug(makeDebug)

let app, exportService, expressServer

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
    name: 'json',
    service: 'objects',
    query: '{ $and: [{ year: { $gte: 1970 } }, { year: { $lt: 1980 } }] }'
  },
  {
    name: 'geojson',
    service: 'features'
  },
  {
    name: 'csv',
    service: 'records'
  }
]

function getDataset (scenario) {
  return `${scenario.service}.${scenario.name}`
}

function runTests (scenario) {
  it(`[${scenario.name}] unzip dataset`, async () => {
    await unzipDataset(getDataset(scenario))
  })
  it(`[${scenario.name}] fill collection`, async () => {
    const datasetPath = getTmpPath(getDataset(scenario))
    await promisify(pipeline)(
      fs.createReadStream(datasetPath),
      new WriteMongoService({ service: app.service(scenario.service) })
    )
  })
    .timeout(60000)
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
