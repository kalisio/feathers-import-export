import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { promisify } from 'util'
import { pipeline } from 'stream'
import unzipper from 'unzipper'
const tar = await import('tar')

export async function gunzipFile (inputFilePath, outputFilePath) {
  await promisify(pipeline)(
    fs.createReadStream(inputFilePath),
    zlib.createUnzip(),
    fs.createWriteStream(outputFilePath)
  )
}

export async function unzipFile (inputFilePath) {
  await new Promise((resolve, reject) => {
    fs.createReadStream(inputFilePath)
      .pipe(unzipper.Extract({ path: path.dirname(inputFilePath) }))
      .on('close', resolve)
      .on('error', reject)
  })
}

export async function untarFile (inputFilePath) {
  await tar.x({
    file: inputFilePath,
    C: path.dirname(inputFilePath)
  })
}
