import JSONImporter from './importer.json.js'
import GEOJSONImporter from './importer.geojson.js'

export const importers = {
  'application/json': JSONImporter,
  'application/geo+json': GEOJSONImporter
}