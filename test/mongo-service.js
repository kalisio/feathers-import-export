import { MongoClient } from 'mongodb'
import { MongoDBService } from '@feathersjs/mongodb'

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
  database.collection(name).drop()
}
