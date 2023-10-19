import fs from 'fs'
import feathers from '@feathersjs/feathers'
import express from '@feathersjs/express'
import { Service as S3Service } from '@kalisio/feathers-s3'
import chai, { util, expect } from 'chai'
import chailint from 'chai-lint'
import { Service } from '../lib/index.js'
import { createMongoService, removeMongoService } from './mongo-service.js'
import makeDebug from 'debug'

// TMP
import Parser from 'stream-json/Parser.js'
import Pick from 'stream-json/filters/Pick.js'
import StreamValues from 'stream-json/streamers/StreamValues.js'
import { promisify } from 'util'
import { pipeline } from 'stream'

const pipelineAsync = promisify(pipeline)

feathers.setDebug(makeDebug)

let app, mongoService, s3Service, importService, expressServer

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
  prefix: 'exports'
}

const exportOptions = {
  s3Service: 's3',
  workingDir: './test/tmp'
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
    // create a dummy service
    app.use('features', await createMongoService('features'))
    mongoService = app.service('features')
    expect(mongoService).toExist()
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

  it('fill the movies collection', async () => {
    const parser = new Parser()

    let objectCounter = 0
    parser.on('data', data => data.name === 'startObject' && ++objectCounter)
    parser.on('end', () => console.log(`Found ${objectCounter} objects.`))

    await pipelineAsync(
      fs.createReadStream('./test/data/features.geojson'),
      parser,
      new Pick({ filter: 'type' }),
      new StreamValues()
    )
  })

  after(async () => {
    await removeMongoService('movies')
    await expressServer.close()
  })
})
