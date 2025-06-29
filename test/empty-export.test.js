import feathers from '@feathersjs/feathers'
import express from '@feathersjs/express'
import { Service as S3Service } from '@kalisio/feathers-s3'
import chai, { util, expect } from 'chai'
import chailint from 'chai-lint'
import { Service } from '../lib/index.js'
import { createMongoService, removeMongoService } from './utils.mongodb.js'
import { getTmpPath, gunzipDataset, clearDataset } from './utils.dataset.js'
import makeDebug from 'debug'

feathers.setDebug(makeDebug)

let app
let s3Service
let service
let expressServer
let inputId

const options = {
  workingDir: './test/tmp',
  s3Options: {
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
    prefix: Date.now().toString()
  }
}

const scenarios = [
  {
    name: 'objects',
    dataset: 'objects.json',
    upload: {
      contentType: 'application/json'
    },
    import: {
      method: 'import',
      id: 'objects.json',
      servicePath: 'objects',
      transform: {
        omit: ['thumbnail', 'thumbnail_width', 'thumbnail_height', 'href']
      }
    },
    export: {
      method: 'export',
      servicePath: 'objects',
      query: { $and: [{ year: { $lte: 1000 } }] },
      transform: {
        omit: ['_id']
      },
      format: 'json'
    },
    expect: {
      import: {
        objects: 36273
      },
      export: {
        objects: 0
      }
    }
  }
]

function runTests (scenario) {
  it(`[${scenario.name}] unzip input dataset`, async () => {
    await gunzipDataset(scenario.dataset)
  })
  it(`[${scenario.name}] upload input dataset`, async () => {
    const response = await s3Service.uploadFile({
      filePath: getTmpPath(scenario.dataset),
      contentType: scenario.upload.contentType,
      chunkSize: 1024 * 1024 * 10
    })
    expect(response.id)
    inputId = response.id
  })
    .timeout(120000)
  it(`[${scenario.name}] import input dataset`, async () => {
    const response = await service.create(scenario.import)
    expect(response.objects).to.equal(scenario.expect.import.objects)
  })
    .timeout(120000)
  it(`[${scenario.name}] check imported collection`, async () => {
    const service = app.service(scenario.import.servicePath)
    const response = await service.find()
    expect(response.total).to.equal(scenario.expect.import.objects)
  })
  it(`[${scenario.name}] clean input dataset`, async () => {
    const response = await s3Service.remove(inputId)
    expect(response.$metadata.httpStatusCode).to.equal(204)
    clearDataset(scenario.dataset)
  })
  it(`[${scenario.name}] export collection`, async () => {
    const response = await service.create(scenario.export)
    expect(response.objects).to.equal(scenario.expect.export.objects)
    expect(response.id).beUndefined()
    expect(response.filename).beUndefined()
  })
    .timeout(180000)
  it(`[${scenario.name}] export collection as zip`, async () => {
    const response = await service.create(Object.assign(scenario.export, { archive: 'zip' }))
    expect(response.objects).to.equal(scenario.expect.export.objects)
    expect(response.id).beUndefined()
    expect(response.filename).beUndefined()
  })
    .timeout(180000)
  it(`[${scenario.name}] export collection as tgz`, async () => {
    const response = await service.create(Object.assign(scenario.export, { archive: 'tgz' }))
    expect(response.objects).to.equal(scenario.expect.export.objects)
    expect(response.id).beUndefined()
    expect(response.filename).beUndefined()
  })
    .timeout(180000)    
  it(`[${scenario.name}] list output files`, async () => {
    const response = await s3Service.find()
    expect(response.length).to.equal(0)
  })
}

describe('feathers-import-export:empty-export', () => {
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
      app.use(scenario.name, await createMongoService(scenario.name))
      expect(app.service(scenario.name)).toExist()
    }
    // create s3 service
    app.use('path-to-s3', new S3Service(options.s3Options), {
      methods: ['uploadFile', 'downloadFile']
    })
    s3Service = app.service('path-to-s3')
    expect(s3Service).toExist()
    // create import-export service
    app.use('import-export', new Service(Object.assign(options, { app })))
    service = app.service('import-export')
    expect(service).toExist()
    // run the server
    expressServer = await app.listen(3333)
  })

  // run the scenarios
  for (const scenario of scenarios) runTests(scenario)

  after(async () => {
    for (const scenario of scenarios) await removeMongoService(scenario.name)
    await expressServer.close()
  })
})
