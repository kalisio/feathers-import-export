import JSONImporter from './importers.json.js'
import GEOJSONImporter from './importers.geojson.js'
import CSVImporter from './importers.csv.js'

export const importers = {
  'application/json': JSONImporter,
  'application/geo+json': GEOJSONImporter,
  'text/csv': CSVImporter
}
