import JSONImporter from './importer.json.js'
import GEOJSONImporter from './importer.geojson.js'
import CSVImporter from './importer.csv.js'

export const importers = {
  'application/json': JSONImporter,
  'application/geo+json': GEOJSONImporter,
  'text/csv': CSVImporter
}
