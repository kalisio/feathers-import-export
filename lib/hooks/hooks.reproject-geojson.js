import fs from 'fs'
import { execSync } from 'child_process'

import createDebug from 'debug'
const debug = createDebug('feathers-import-export:export:hooks:reproject-geojson')

// this hook requires GDAL 3.1
export async function reprojectGeoJson (hook) {
  if (hook.type !== 'before') {
    throw new Error('The \'reproject\' hook should only be used as a \'before\' hook.')
  }
  if (!hook.data.context.reproject) return
  if (hook.data.context.format !== 'geojson') {
    throw new Error('The \'convert\' requires the \'format\' property to be set to \'geojson\'')
  }
  if (!hook.data.context.reproject.srs) {
    throw new Error('The \'reproject\' requires the `reproject/srs` property to be set')
  }
  debug('Running reproject hook')
  // create ogr input file
  const inputFile = `${hook.data.filePath}.geojson`
  fs.copyFileSync(hook.data.filePath, inputFile)
  // reproject the file
  const ogr2ogr = `ogr2ogr -f GeoJSON -s_srs EPSG:4326 -t_srs ${hook.data.context.reproject.srs} ${hook.data.filePath} ${inputFile}`
  debug(ogr2ogr)
  await execSync(ogr2ogr)
  // remove input file
  fs.unlinkSync(inputFile)
}
