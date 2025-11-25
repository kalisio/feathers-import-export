import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'
import { getFullExtension } from '../utils.js'
import createDebug from 'debug'

const debug = createDebug('feathers-import-export:export:hooks:reproject-geojson')

// this hook requires GDAL 3.1
export async function reprojectGeoJson (hook) {
  if (hook.type !== 'before') {
    throw new Error('The \'reprojectGeoJson\' hook should only be used as a \'before\' hook.')
  }
  if (!hook.data.context.reprojectGeoJson) return
  if (hook.data.context.format !== 'geojson') {
    throw new Error('The \'reprojectGeoJson\' requires the \'format\' property to be set to \'geojson\'')
  }
  if (hook.data.context.archive) {
    throw new Error('The \'convertGeoJson\' cannot be applied to an archive')
  }
  if (!hook.data.context.reprojectGeoJson.srs) {
    throw new Error('The \'reprojectGeoJson\' requires the `reprojectGeoJson/srs` property to be set')
  }
  debug('Running reproject hook')
  // create a working dir
  const workingDir = `${hook.data.filePath}-reproject`
  fs.mkdirSync(workingDir)
  // create ogr input file
  const inputFile = path.join(workingDir, `${hook.data.context.uuid}.geojson`)
  fs.copyFileSync(hook.data.filePath, inputFile)
  // compute ogr output file
  const outputFile = path.join(workingDir, hook.data.context.filename)
  // retrieve ogr output layer name
  const extFilename = getFullExtension(hook.data.context.filename)
  const layerName = path.basename(hook.data.context.filename, extFilename)
  // reproject the file
  const ogr2ogr = `ogr2ogr -f GeoJSON -s_srs EPSG:4326 -t_srs ${hook.data.context.reprojectGeoJson.srs} -nln ${layerName} ${outputFile} ${inputFile}`
  debug(ogr2ogr)
  await execSync(ogr2ogr)
  // remove input file
  fs.copyFileSync(outputFile, hook.data.filePath)
  fs.rmSync(workingDir, { recursive: true, force: true })
}
