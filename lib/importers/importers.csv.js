import Papa from 'papaparse'

export default {
  stream () {
    return Papa.parse(Papa.NODE_STREAM_INPUT, { header: true })
  }
}
