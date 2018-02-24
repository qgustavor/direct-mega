/* eslint-env serviceworker */

import { File } from 'megajs'
import escapeHTML from 'escape-html'
import mime from 'mime-types'
import rangeParser from 'range-parser'
import bytes from 'bytes'

self.addEventListener('install', function (event) {
  if (event.registerForeignFetch) {
    event.registerForeignFetch({
      scopes: [self.registration.scope],
      origins: ['*']
    })
  }

  // Try to make an stream, if it fails the SW will not install
  const stream = new self.ReadableStream()
  event.waitUntil(stream && self.skipWaiting())
})

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim())
})

// A page on GitHub Pages? We don't have any credentials!
// So we will not spend a single line doing the noCredentialsRequest trick!
self.addEventListener('foreignfetch', fetchHandler)
self.addEventListener('fetch', fetchHandler)

// Some content types that don't work unless CSP is disabled
const CSP_WHITELIST = [
  // For some reason PDFs are blocked in sandboxed pages
  // in Chrome... even if it has it's own PDF renderer
  'application/pdf',
  // Chrome hides the controls because styles aren't applied
  'video/',
  'audio/'
]

function generateFileList (file, baseURL) {
  if (!file.children) return `<i>Empty folder</i>`
  return `<ul>${file.children.sort((left, right) => {
    return (left.name || '').localeCompare(right.name || '')
  }).map(file => {
    if (file.directory) {
      return `<li><details>
        <summary><strong>${escapeHTML(file.name)}</strong></summary>
        ${generateFileList(file, baseURL)}
      </details></li>`
    }
    return `<li>
      <a href="${escapeHTML(baseURL + '!' + file.downloadId[1])}">${escapeHTML(file.name)}</a>
      <small>${bytes(file.size)} - ${new Date(file.timestamp * 1000).toLocaleString()}</small>
    </li>`
  }).join('\n')}</ul>`
}

const FILE_CACHE = Object.create(null)
function fetchHandler (event) {
  if (event.request.method !== 'GET') return

  const requestURL = event.request.url
  if (!requestURL.includes(self.location.origin)) return

  const parsedURL = new self.URL(requestURL)

  // Allow access to the splitter
  if (parsedURL.pathname === '/splitter') return
  if (parsedURL.pathname === '/splitter.js') return

  // But remove the .html extension
  if (parsedURL.pathname === '/splitter.html') {
    event.respondWith(self.Response.redirect('/splitter'))
    return
  }

  const urlArguments = (parsedURL.search || '').substr(1).split('&')
  const identifier = urlArguments[0]

  const extraArguments = urlArguments.slice(1).reduce((obj, element) => {
    const parts = element.split('=')
    if (parts.length === 1) {
      obj[element.toLowerCase()] = true
    } else {
      obj[parts[0].toLowerCase()] = self.decodeURIComponent(parts.slice(1).join('='))
    }
    return obj
  }, {})

  // Shorthands
  if (extraArguments.n) extraArguments.name = extraArguments.n
  if (extraArguments.c) extraArguments.cipher = extraArguments.c
  if (typeof extraArguments.cipher === 'string') {
    extraArguments.name = extraArguments.cipher
  }

  const parts = identifier.split('!')
  const isDirectory = parts[0] === 'F'
  const isValid = parts.length > 1 && (parts[0] === '' || isDirectory)
  const isView = parsedURL.pathname.includes('/view')
  const range = event.request.headers.get('Range')

  const response = isValid
  ? (new Promise((resolve, reject) => {
    if (!extraArguments.cipher && !parts[2]) throw Error('Missing encryption key')

    const file = new File({
      downloadId: parts[1],
      key: extraArguments.cipher ? null : parts[2],
      directory: isDirectory,
      loadedFile: parts[3]
    })

    const cacheId = parts[1] + '_' + parts[3]
    if (FILE_CACHE[cacheId]) {
      setTimeout(afterGotAttributes, 0, null, FILE_CACHE[cacheId])
    } else {
      file.loadAttributes(afterGotAttributes)
    }

    function afterGotAttributes (err, file) {
      if (err) return reject(err)

      if (!FILE_CACHE[cacheId]) {
        FILE_CACHE[cacheId] = file
      }

      if (file.directory) {
        const baseURL = parsedURL.origin + parsedURL.pathname + '?' + identifier.split('!').slice(0, 3).join('!')
        const folderContent = `<!DOCTYPE html><meta charset="utf-8">
<title>"${escapeHTML(file.name)}" folder contents - Direct MEGA</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{margin:20px;line-height:1.6;font-size:18px;color:#444;padding:0 10px}h1,h2,h3{line-height:1.2}small{float:right;opacity:.8}</style>
<h1>"${escapeHTML(file.name)}" folder contents</h1>
${generateFileList(file, baseURL)}`

        const response = new self.Response(folderContent, { headers: {
          'Content-Type': 'text/html',
          'Content-Security-Policy': 'sandbox'
        }})
        resolve(response)
        return
      }

      const headers = {}

      const useHttpRange = extraArguments['use-http-range']
      if (useHttpRange) {
        headers['Accept-Ranges'] = 'bytes'
      }

      const date = new Date(file.timestamp * 1000)
      if (!isNaN(date.getTime())) {
        headers['Last-Modified'] = date.toGMTString()
        headers['Date'] = headers['Last-Modified']
      }

      let start = extraArguments.start && (bytes.parse(extraArguments.start) || null)
      let end = extraArguments.end && (bytes.parse(extraArguments.end) || null)

      if (useHttpRange && range) {
        const parsedRange = rangeParser(file.size, range, { combine: true })
        if (parsedRange === -1 || parsedRange === -2 || parsedRange.length > 1) {
          resolve(new self.Response(new self.Blob(['Range Not Satisfiable']), {
            status: 416,
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'Content-Range': '*/0'
            }
          }))
          return
        }

        start = parsedRange[0].start
        end = parsedRange[0].end

        headers['Content-Range'] = `bytes ${start}-${end}/${file.size}`
        headers['Content-Length'] = end - start + 1
      } else {
        headers['Content-Length'] = (end || (file.size - 1)) - (start || 0) + 1
      }

      const fileName = extraArguments.name || file.name
      const contentType = mime.contentType(fileName) || 'application/octet-stream'
      if (isView) {
        if (!CSP_WHITELIST.find(type => contentType.startsWith(type))) {
          headers['Content-Security-Policy'] = 'default-src none ' + requestURL + '; sandbox'
        }
        headers['Content-Type'] = contentType
      } else {
        headers['Content-Disposition'] = "attachment; filename*=UTF-8''" + self.encodeURIComponent(fileName)
        headers['Content-Type'] = 'application/octet-stream; charset=utf-8'
      }

      const stream = file.download({
        returnCiphertext: !!extraArguments.cipher,
        maxConnections: extraArguments.connections,
        start,
        end
      })

      // Chrome doesn't call cancel method when it stops downloading
      // But it always calls the pull method within 10ms after data
      // is enqueued and stops calling it when it stops downloading
      let cancelTimeout = null
      function handleCancel () {
        stream.emit('close')
      }

      resolve(new self.Response(new self.ReadableStream({
        start: controller => {
          stream.on('data', data => {
            // Sometimes it fails so check if pull is called within 5 seconds
            if (cancelTimeout === null) {
              cancelTimeout = setTimeout(handleCancel, 5e3)
            }
            controller.enqueue(new Uint8Array(data))
          })
          stream.on('error', (error) => controller.error(error))
          stream.on('end', () => controller.close())
        },
        pull () {
          clearTimeout(cancelTimeout)
          cancelTimeout = null
        },
        cancel: () => {
          stream.emit('close')
        }
      }), {
        status: useHttpRange && range ? 206 : 200,
        headers
      }))
    }
  })).catch(error => {
    const fileNotFound = error.message && (
      error.message.includes('ENOENT (-9)') ||
      error.message.includes('EACCESS (-11)') ||
      error.message.includes('EBLOCKED (-16)')
    )
    const wrongKey = error.message && error.message.includes('could not be decrypted')
    const invalidURL = error.message && error.message.includes('Invalid argument: ')
    const tooManyConnections = error.message && error.message.includes('ETOOMANY')
    const bandwidthLimit = error.message && error.message.includes('Bandwidth limit')
    const rangeError = error.message && error.message === "You can't download past the end of the file."
    const missingKey = error.message && error.message === 'Missing encryption key'
    const invalidArguments = error.message && error.message.includes('EARGS (-2)')
    const corruptedJSON = error.message && error.message.includes('Unexpected end of JSON input')

    if (!(fileNotFound || wrongKey || invalidURL || tooManyConnections ||
      bandwidthLimit || rangeError || missingKey || invalidArguments || corruptedJSON)) {
      setTimeout(() => {
        // Rollbar JavaScript API isn't compatible with Service Workers, so we're using the JSON API
        self.fetch('https://api.rollbar.com/api/1/item/', {
          method: 'POST',
          body: JSON.stringify({
            'access_token': 'e7dce51c0e174102bad8179a5c5680ac',
            'data': {
              'environment': 'production',
              'platform': 'browser',
              'request': {
                'url': requestURL
              },
              'body': {
                'message': {
                  'body': error.stack || error
                }
              },
              'client': {
                'browser': navigator.userAgent
              }
            }
          })
        })
      }, 100)
    } else {
      const title = invalidURL ? 'Invalid URL'
        : fileNotFound ? 'File Not Found'
        : tooManyConnections ? 'Too many connections'
        : bandwidthLimit ? 'Bandwidth limit reached'
        : rangeError ? 'Range error'
        : missingKey ? 'Missing decryption key'
        : invalidArguments ? 'Temporary error'
        : corruptedJSON ? 'Temporary error'
        : 'Invalid Decryption Key'
      const message = rangeError
      ? `You specified an invalid download range.`
      : bandwidthLimit
      ? `You reached the bandwidth limit.`
      : tooManyConnections
      ? `Too many connections are acessing this file. Try again later.`
      : invalidURL
      ? `The provided URL includes invalid characters. Check it and try again.`
      : fileNotFound
      ? `Sorry, but the file you were trying to ${isView ? 'view' : 'download'} does not exist.`
      : invalidArguments
      ? `The server couldn't process your request. Try again later.`
      : corruptedJSON
      ? `The server returned a corrupted result. Try again later.`
      : `The provided decryption key is invalid. Check the URL and try again.`
      const status = fileNotFound ? 404
        : tooManyConnections || bandwidthLimit ? 429
        : rangeError ? 416
        : 403

      // From HTML5 Boilerplate
      return new self.Response(
        new self.Blob([`<!doctype html><html lang=en><head><meta charset=utf-8><title>${title} - Direct MEGA</title>
        <meta name=viewport content="width=device-width, initial-scale=1">
<style>*{line-height:1.2;margin:0}html{color:#888;display:table;font-family:sans-serif;height:100%;text-align:center;width:100%}body{display:table-cell;vertical-align:middle;margin:2em auto}h1{color:#555;font-size:2em;font-weight:400}p{margin:0 auto;width:280px}@media only screen and (max-width:280px){body,p{width:95%}h1{font-size:1.5em;margin:0 0 .3em}}</style></head><body><h1>${title}</h1><p>${message}</p></body></html>`]),
        {status, headers: { 'Content-Type': 'text/html; charset=utf-8' }}
      )
    }

    const errorKind = !error.message ? 'Internal error!'
    : error.message.includes('ESID (-15)') || error.message.includes('EARGS (-2)')
    ? "That's a weird error from MEGA. Please, try again later."
    : error.message.includes(' (-')
    ? "Seems it's an error from MEGA."
    : 'Unknown error!'

    return new self.Response(
      new self.Blob([
        errorKind, '\n', error.stack || error,
        '\n\nYou can report this issue here: https://github.com/qgustavor/direct-mega/issues',
        '\n\nYou can also try loading it directly in MEGA: https://mega.nz/#', identifier,
        '\nPlease note: if loading the file in MEGA fails then it will not load here.'
      ]),
      {status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' }}
    )
  })
  // If 'main.js' is requested then the worker wasn't ready yet...
  : parsedURL.pathname.includes('/main.js')
  ? new self.Response(new self.Blob(['setTimeout(()=>location.reload(),9)'], {type: 'application/javascript'}))
  // Service Worker is installed but no file was requested, check the hash and redirect to help page:
  : new self.Response(new self.Blob([`<!doctype html><title>Direct MEGA</title>
    <script>location.href=location.hash.length>1?location.href.replace('#','?')
    :'https://github.com/qgustavor/direct-mega#direct-mega'</script>`], {type: 'text/html'}))

  event.respondWith(response)
}
