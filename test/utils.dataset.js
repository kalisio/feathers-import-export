import fs from 'fs'
import zlib from 'zlib'
import { promisify } from 'util'
import { pipeline } from 'stream'

const dataPath = './test/data'
const tmpPath = './test/tmp'

export function getDataPath (dataset) {
  return `${dataPath}/${dataset}.gz`
}
export function getTmpPath (dataset) {
  return `${tmpPath}/${dataset}`
}

export async function unzipFile (inputFilePath, outputFilePath) {
  await promisify(pipeline)(
    fs.createReadStream(inputFilePath),
    zlib.createUnzip(),
    fs.createWriteStream(outputFilePath)
  )
}

export async function unzipDataset (dataset) {
  const inputFilePath = getDataPath(dataset)
  const outputFilePath = getTmpPath(dataset)
  return unzipFile(inputFilePath, outputFilePath)
}

export function clearDataset (dataset) {
  fs.unlinkSync(getTmpPath(dataset))
}
