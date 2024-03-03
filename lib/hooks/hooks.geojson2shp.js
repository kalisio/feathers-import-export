import _ from 'lodash'
import path from 'path'
import { execSync } from 'child_process'

import createDebug from 'debug'
const debug = createDebug('feathers-import-export:export:hooks:geojson2shp')

// this hook requires GDAL 3.1
export async function geojson2shp (hook) {
    if (hook.type !== 'before') {
      throw new Error('The \'geojson2shp\' hook should only be used as a \'before\' hook.')
    }
    if (!_.endsWith(hook.data.context.filename, 'shp.zip')) return
    debug(`Running geojson2shp hook`)
    const uuid = path.basename(hook.data.filePath)
    const geojsonFilename = hook.data.context.filename.replace('shp.zip', 'geojson')
    const geojsonFilePath = hook.data.filePath.replace(uuid, geojsonFilename)
    const shpFilename = hook.data.context.filename
    const shpFilePath =  hook.data.filePath.replace(uuid, shpFilename)
    // change the geojson filename to ensure the final zip files will be named correctly
    await execSync(`mv ${hook.data.filePath} ${geojsonFilePath}`)
    // convert the geojson file intoa zipped shapefile
    await execSync(`ogr2ogr -f 'ESRI Shapefile' ${shpFilePath} ${geojsonFilePath}`)
    // restore the filename with the correct uuid
    await execSync(`mv ${shpFilePath} ${hook.data.filePath} && rm ${geojsonFilePath}`)
    // update the content type
    hook.data.contentType = 'application/zip'
  }