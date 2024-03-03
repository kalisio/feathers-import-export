import JSONExporter from './exporters.json.js'
import GEOJSONExporter from './exporters.geojson.js'
import CSVExporter from './exporters.csv.js'

export const exporters = {
  json: JSONExporter,
  geojson: GEOJSONExporter,
  csv: CSVExporter
}
