import feathers from '@feathersjs/feathers'
import express from '@feathersjs/express'
import { Service as S3Service } from '@kalisio/feathers-s3'
import chai, { util, expect } from 'chai'
import chailint from 'chai-lint'
import { Service } from '../lib/index.js'
import { createMongoService, removeMongoService } from './mongo-service.js'
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
    filePath: './test/data/objects.json',
    mimeType: 'application/json',
    service: 'objects',
    total: 36273
  },
  {
    filePath: './test/data/features.geojson',
    mimeType: 'application/geo+json',
    service: 'features',
    total: 17008
  },
  {
    filePath: './test/data/records.csv',
    mimeType: 'text/csv',
    service: 'records',
    total: 125
  }
]

function runTests (scenario) {
  it(`upload file ${scenario.filePath} of type of ${scenario.mimeType}`, async () => {
    const response = await s3Service.uploadFile({ filePath: scenario.filePath, mimeType: scenario.mimeType })
    id = response.id
  })
  it(`import uploaded file ${scenario.filePath}`, async () => {
    const response = await importService.import({ id, service: scenario.service })
    expect(response.id).toExist()
  })
  it(`check documents count for service ${scenario.service}`, async () => {
    const service = app.service(scenario.service)
    const response = await service.find()
    expect(response.total).to.equal(scenario.total)
  })
  it(`remove file ${scenario.filePath}`, async () => {
    const response = await s3Service.remove(id)
    expect(response.$metadata.httpStatusCode).to.equal(204)
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

  for (const scenario of scenarios) runTests(scenario)

  after(async () => {
    for (const scenario of scenarios) await removeMongoService(scenario.service)
    await expressServer.close()
  })
})
