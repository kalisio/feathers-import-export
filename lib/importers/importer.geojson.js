import geojsonStream from 'geojson-stream'

export default {
  stream () {
    return geojsonStream.parse()
  }
}
