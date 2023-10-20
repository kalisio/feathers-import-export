import jsonStream from 'JSONStream'

export default {
  stream () {
    return jsonStream.parse('features.*')
  }
}
