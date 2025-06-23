import { execSync } from 'child_process'

import createDebug from 'debug'
const debug = createDebug('feathers-import-export:export:hooks:convert-geojson')

// this hook requires GDAL 3.1
export async function convertGeoJson (hook) {
  if (hook.type !== 'before') {
    throw new Error('The \'convert\' hook should only be used as a \'before\' hook.')
  }
  if (!hook.data.context.convert) return
  if (!hook.data.context.filename) {
    throw new Error('The \'convert\' needs the `filename` property.')
  }
  if (!hook.data.context.convert.ogrDriver) {
    throw new Error('The \'convert\' needs the `convert/ogrDriver` property.')
  }
  if (!hook.data.context.convert.contentType) {
    throw new Error('The \'convert\' needs the `convert/contentType` property.')
  }
  debug('Running convert hook')
  // create ogr input file
  const inputFile = `${hook.data.filePath}.geojson`
  await execSync(`mv ${hook.data.filePath} ${inputFile}`)
  // compute ogr output file
  const outputFile = `${hook.data.filePath}-${hook.data.context.filename}`
  // convert the file
  const ogr2ogr = `ogr2ogr -f '${hook.data.context.convert.ogrDriver}' ${outputFile} ${inputFile}`
  debug(ogr2ogr)
  await execSync(ogr2ogr)
  // restore the output with the correct uuid
  await execSync(`mv ${outputFile} ${hook.data.filePath}`)
  // update the content type
  hook.data.contentType = hook.data.context.convert.contentType
}
