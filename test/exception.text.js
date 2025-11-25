import feathers from '@feathersjs/feathers'
import express from '@feathersjs/express'
import { Service as S3Service } from '@kalisio/feathers-s3'
import chai, { util, expect } from 'chai'
import chailint from 'chai-lint'
import { Service } from '../lib/index.js'
import { createMongoService, removeMongoService } from './utils.mongodb.js'
import makeDebug from 'debug'

feathers.setDebug(makeDebug)

let app
let s3Service
let service
let expressServer

const options = {
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
  },
  allowedServicePaths: 'objects',
  workingDir: './test/tmp'
}

describe('feathers-import-export:exception', () => {
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
    expect(app.service('objects')).toExist()
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

  it('fail to import with a non allowed service path', async () => {
    try {
      await service.create({
        method: 'import',
        id: 'objects.json',
        servicePath: 'users'
      })
    } catch (error) {
      // ensure the error was raised
      expect(error).toExist()
      expect(error.message).is.equal('import: service path \'users\' is not allowed')
    }
  })

  it('fail to export with a non allowed service path', async () => {
    try {
      await service.create({
        method: 'export',
        servicePath: 'users',
        format: 'json'
      })
    } catch (error) {
      // ensure the error was raised
      expect(error).toExist()
      expect(error.message).is.equal('export: service path \'users\' is not allowed')
    }
  })

  after(async () => {
    await removeMongoService('objects')
    await expressServer.close()
  })
})
