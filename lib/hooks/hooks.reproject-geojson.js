import { execSync } from 'child_process'

import createDebug from 'debug'
const debug = createDebug('feathers-import-export:export:hooks:reproject-geojson')

// this hook requires GDAL 3.1
export async function reprojectGeoJson (hook) {
  if (hook.type !== 'before') {
    throw new Error('The \'reproject\' hook should only be used as a \'before\' hook.')
  }
  const targetSrs = hook.data.context.reproject
  if (!targetSrs) return
  debug('Running reproject hook')
  // create ogr input file
  const inputFile = `${hook.data.filePath}.geojson`
  await execSync(`mv ${hook.data.filePath} ${inputFile}`)
  // reproject the file
  const ogr2ogr = `ogr2ogr -f GeoJSON -s_srs EPSG:4326 -t_srs ${targetSrs} ${hook.data.filePath} ${inputFile}`
  debug(ogr2ogr)
  await execSync(ogr2ogr)
  // remove input file
  await execSync(`rm ${inputFile}`)
}
