import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'

import createDebug from 'debug'
const debug = createDebug('feathers-import-export:export:hooks:convert-geojson')

function getAllExtensions (filename) {
  const base = path.basename(filename)
  const parts = base.split('.')
  if (parts.length <= 1) return ''
  parts.shift() // remove the main filename before first dot
  return '.' + parts.join('.')
}

// this hook requires GDAL 3.1
export async function convertGeoJson (hook) {
  if (hook.type !== 'before') {
    throw new Error('The \'convert\' hook should only be used as a \'before\' hook.')
  }
  if (!hook.data.context.convert) return
  if (hook.data.context.format !== 'geojson') {
    throw new Error('The \'convert\' requires the \'format\' property to be set to \'geojson\'')
  }
  if (!hook.data.context.filename) {
    throw new Error('The \'convert\' requires the \'filename\' property to be set')
  }
  if (!hook.data.context.convert.ogrDriver) {
    throw new Error('The \'convert\' requires the \'convert/ogrDriver\' property to be set')
  }
  if (!hook.data.context.convert.contentType) {
    throw new Error('The \'convert\' requires the \'convert/contentType\' property to be set')
  }
  debug('Running convert hook')
  // const uuid = path.basename(hook.data.filePath)
  const workingDir = `${hook.data.filePath}-tmp`
  fs.mkdirSync(workingDir)
  // create ogr input file
  const extFilename = getAllExtensions(hook.data.context.filename)
  const baseFilename = path.basename(hook.data.context.filename, extFilename)
  const inputFile = path.join(workingDir, `${baseFilename}.geojson`)
  fs.copyFileSync(hook.data.filePath, inputFile)
  // compute ogr output file
  const outputFile = path.join(workingDir, hook.data.context.filename)
  // convert the file
  const ogr2ogr = `ogr2ogr -f '${hook.data.context.convert.ogrDriver}' ${outputFile} ${inputFile}`
  debug(ogr2ogr)
  await execSync(ogr2ogr)
  // restore the output with the correct uuid
  fs.copyFileSync(outputFile, hook.data.filePath)
  fs.rmSync(workingDir, { recursive: true, force: true })
  // update the content type
  hook.data.contentType = hook.data.context.convert.contentType
}
