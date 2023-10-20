import { MongoClient } from 'mongodb'
import { MongoDBService } from '@feathersjs/mongodb'
import { Writable } from 'stream'

let client
let database

export async function createMongoService (name) {
  client = new MongoClient('mongodb://127.0.0.1:27017')
  await client.connect()
  database = client.db('feathers-import-export')
  return new MongoDBService({
    Model: database.collection(name),
    multi: true,
    paginate: {
      default: 10,
      max: 50
    }
  })
}

export async function removeMongoService (name) {
  await database.collection(name).drop()
}

export class WriteMongoService extends Writable {
  constructor(options) {
    super(Object.assign(options, { objectMode: true }))
    this.service = options.service
  }
  async _write(chunk, encoding, next) {
    await this.service.create(chunk)
    next()
  }
}