import fs from 'fs'
import crypto from 'crypto'
import feathers from '@feathersjs/feathers'
import express from '@feathersjs/express'
import { Service as S3Service } from '@kalisio/feathers-s3'
import chai, { util, expect } from 'chai'
import chailint from 'chai-lint'
import { Service, hooks } from '../lib/index.js'
import { createMongoService, removeMongoService } from './utils.mongodb.js'
import { getTmpPath, unzipDataset, clearDataset } from './utils.dataset.js'
import makeDebug from 'debug'

feathers.setDebug(makeDebug)

let app
let s3Service
let service
let expressServer
let inputId
let outputId

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
    prefix: crypto.randomUUID()
  }
}

const scenarios = [
  {
    name: 'features',
    dataset: 'features.geojson',
    upload: {
      contentType: 'application/geo+json'
    },
    import: {
      method: 'import',
      id: 'features.geojson',
      servicePath: 'features'
    },
    export: {
      method: 'export',
      servicePath: 'features',
      chunkSize: 100,
      transform: {
        omit: ['_id']
      },
      format: 'geojson',
      gzip: false,
      filename: 'features.shp.zip'
    },
    expect: {
      import: {
        objects: 255
      },
      export: {
        objects: 255,
        size: 5323872
      }
    }
  }
]

function runTests (scenario) {
  it(`[${scenario.name}] unzip input dataset`, async () => {
    await unzipDataset(scenario.dataset)
  })
  it(`[${scenario.name}] upload input dataset`, async () => {
    const response = await s3Service.uploadFile({
      filePath: getTmpPath(scenario.dataset),
      contentType: scenario.upload.contentType,
      chunkSize: 1024 * 1024 * 10
    })
    expect(response.id).toExist()
    inputId = response.id
  })
    .timeout(300000)
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
    expect(response.id).toExist()
    outputId = response.id
  })
    .timeout(180000)
  it(`[${scenario.name}] list output files`, async () => {
    const response = await s3Service.find()
    expect(response.length).to.equal(1)
  })
  it(`[${scenario.name}] download output files`, async () => {
    const tmpFilePath = getTmpPath(outputId)
    const response = await s3Service.downloadFile({ id: outputId, filePath: tmpFilePath })
    expect(response.id).toExist()
    // check the size of the uncompressed file
    const size = fs.statSync(getTmpPath(outputId)).size
    expect(size).to.be.closeTo(scenario.expect.export.size, 1)
  })
  it(`[${scenario.name}] clean output files`, async () => {
    const response = await s3Service.remove(outputId)
    expect(response.$metadata.httpStatusCode).to.equal(204)
    clearDataset(outputId)
    outputId = undefined
  })
}

describe('feathers-import-export-hooks', () => {
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
    service.s3Service.hooks({
      before: {
        uploadFile: [hooks.geojson2shp]
      }
    })
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
