import fs from 'fs'
import { gunzipFile } from './utils.archive.js'

const dataPath = './test/data'
const tmpPath = './test/tmp'

export function getDataPath (dataset) {
  return `${dataPath}/${dataset}.gz`
}

export function getTmpPath (dataset) {
  return `${tmpPath}/${dataset}`
}

export async function gunzipDataset (dataset) {
  const inputFilePath = getDataPath(dataset)
  const outputFilePath = getTmpPath(dataset)
  return gunzipFile(inputFilePath, outputFilePath)
}

export function clearDataset (dataset) {
  fs.unlinkSync(getTmpPath(dataset))
}
