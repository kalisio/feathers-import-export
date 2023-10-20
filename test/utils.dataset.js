import fs from 'fs'
import zlib from 'zlib'
import { promisify } from 'util'
import { pipeline } from 'stream'

const dataPath = './test/data'
const tmpPath = './test/tmp'

export function getTmpPath (dataset) {
  return `${tmpPath}/${dataset}`
}

export async function unzipDataset (dataset) {
  const archiveFilePath = `${dataPath}/${dataset}.gz`
  await promisify(pipeline)(
    fs.createReadStream(archiveFilePath),
    zlib.createUnzip(),
    fs.createWriteStream(getTmpPath(dataset))
  )
}

export function clearDataset (dataset) {
  fs.unlinkSync(getTmpPath(dataset))
}
