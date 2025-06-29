import fs from 'fs'
import { execSync } from 'child_process'

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
  // create ogr input file
  const inputFile = `${hook.data.filePath}.geojson`
  fs.copyFileSync(hook.data.filePath, inputFile)
  // reproject the file
  const ogr2ogr = `ogr2ogr -f GeoJSON -s_srs EPSG:4326 -t_srs ${hook.data.context.reprojectGeoJson.srs} ${hook.data.filePath} ${inputFile}`
  debug(ogr2ogr)
  await execSync(ogr2ogr)
  // remove input file
  fs.unlinkSync(inputFile)
}
