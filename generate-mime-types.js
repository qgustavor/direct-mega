const mime = require('mime-db')
const fs = require('fs')

const minifiedMimes = Object.entries(mime).reduce((result, [mime, entry]) => {
  if (!entry.extensions) return result
  for (let extension of entry.extensions) result[extension] = mime
  return result
}, {})

fs.writeFileSync('src/mime-types.json', JSON.stringify(minifiedMimes))
