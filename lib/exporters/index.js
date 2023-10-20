import JSONExporter from './exporter.json.js'
import GEOJSONExporter from './exporter.geojson.js'
import CSVExporter from './exporter.csv.js'

export const exporters = {
  json: JSONExporter,
  geojson: GEOJSONExporter,
  csv: CSVExporter
}
