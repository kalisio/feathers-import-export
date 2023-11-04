import mongodb from 'mongodb'
import { MongoDBService } from '@feathersjs/mongodb'

const { MongoClient } = mongodb

let client
let database

export async function createMongoService (name, paginate = { default: 10, max: 50 }) {
  client = new MongoClient('mongodb://127.0.0.1:27017')
  await client.connect()
  database = client.db('feathers-import-export')
  return new MongoDBService({
    Model: database.collection(name),
    multi: true,
    paginate
  })
}

export async function removeMongoService (name) {
  await database.collection(name).drop()
}
