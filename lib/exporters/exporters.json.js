export default {
  type () {
    return 'application/json'
  },
  begin () {
    return '['
  },
  process (info, data) {
    let string = JSON.stringify(data)
    string = string.substring(1, string.length - 1)
    if (info.currentChunk < info.totalChunks - 1) string += ','
    return string
  },
  end () {
    return ']'
  }
}
