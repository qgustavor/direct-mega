/* eslint-env serviceworker */

import { File } from 'megajs'
import escapeHTML from 'escape-html'
import mime from 'mime-types'

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
  'application/pdf'
]

function generateFileList (file, baseURL) {
  return `<ul>${file.children.sort((left, right) => {
    return (left.name || '').localeCompare(right.name || '')
  }).map(file => {
    if (file.directory) {
      return `<li><details>
        <summary><strong>${escapeHTML(file.name)}</strong></summary>
        ${generateFileList(file, baseURL)}
      </details></li>`
    }
    return `<li><a href="${escapeHTML(baseURL + '!' + file.downloadId[1])}">${escapeHTML(file.name)}</a></li>`
  }).join('\n')}</ul>`
}

function fetchHandler (event) {
  if (event.request.method !== 'GET') return

  const requestURL = event.request.url
  if (!requestURL.includes(self.location.origin)) return

  const parsedURL = new self.URL(requestURL)
  const identifier = (parsedURL.search || '').substr(1)
  const hasFile = identifier.startsWith('!') || identifier.startsWith('F!')
  const requiredFile = hasFile && `https://mega.nz/#${identifier}`
  const isView = parsedURL.pathname.includes('/view')

  const response = requiredFile
  ? (new Promise((resolve, reject) => {
    const file = File.fromURL(requiredFile)
    file.loadAttributes((err, file) => {
      if (err) return reject(err)

      if (file.children) {
        const baseURL = parsedURL.origin + parsedURL.pathname + '?' + identifier.split('!').slice(0, 3).join('!')
        const folderContent = `<!DOCTYPE html><meta charset="utf-8">
<title>"${escapeHTML(file.name)}" folder contents - Direct MEGA</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{margin:20px;line-height:1.6;font-size:18px;color:#444;padding:0 10px}h1,h2,h3{line-height:1.2}</style>
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
      headers['Content-Length'] = file.size
      const contentType = mime.contentType(file.name)

      if (isView) {
        if (!CSP_WHITELIST.includes(contentType)) {
          headers['Content-Security-Policy'] = 'default-src none ' + requestURL + '; sandbox'
        }
        headers['Content-Disposition'] = "inline; filename*=UTF-8''" + self.encodeURIComponent(file.name)
        headers['Content-Type'] = contentType
      } else {
        headers['Content-Disposition'] = "attachment; filename*=UTF-8''" + self.encodeURIComponent(file.name)
        headers['Content-Type'] = 'application/octet-stream; charset=utf-8'
      }

      const stream = file.download()

      resolve(new self.Response(new self.ReadableStream({
        start: controller => {
          stream.on('data', data => controller.enqueue(new Uint8Array(data)))
          stream.on('error', (error) => controller.error(error))
          stream.on('end', () => controller.close())
        },
        cancel: () => {
          stream.emit('close')
        }
      }), { headers }))
    })
  })).catch(error => {
    const fileNotFound = error.message && (
      error.message.includes('ENOENT (-9)') ||
      error.message.includes('EACCESS (-11)')
    )
    const wrongKey = error.message && error.message.includes('could not be decrypted')
    const invalidURL = error.message && error.message.includes('Invalid argument: ')

    if (!fileNotFound && !wrongKey && !invalidURL) {
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
    }

    if (fileNotFound || wrongKey || invalidURL) {
      const title = invalidURL ? 'Invalid URL'
        : fileNotFound ? 'File Not Found'
        : 'Invalid Decryption Key'
      const message = invalidURL
      ? `The provided URL includes invalid characters. Check it and try again.`
      : fileNotFound
      ? `Sorry, but the file you were trying to ${isView ? 'view' : 'download'} does not exist.`
      : `The provided decryption key is invalid. Check the URL and try again.`
      const status = fileNotFound ? 404 : 403

      // From HTML5 Boilerplate
      return new self.Response(
        new self.Blob([`<!doctype html><html lang=en><head><meta charset=utf-8><title>${title} - Direct MEGA</title>
        <meta name=viewport content="width=device-width, initial-scale=1">
<style>*{line-height:1.2;margin:0}html{color:#888;display:table;font-family:sans-serif;height:100%;text-align:center;width:100%}body{display:table-cell;vertical-align:middle;margin:2em auto}h1{color:#555;font-size:2em;font-weight:400}p{margin:0 auto;width:280px}@media only screen and (max-width:280px){body,p{width:95%}h1{font-size:1.5em;margin:0 0 .3em}}</style></head><body><h1>${title}</h1><p>${message}</p></body></html>`]),
        {status, headers: { 'Content-Type': 'text/html; charset=utf-8' }}
      )
    }

    const errorKind = !error.message ? 'Internal error!'
    : error.message.includes('ESID (-15)')
    ? "That's a weird error from MEGA. Try again later."
    : error.message.includes(' (-')
    ? "Seems it's an error from MEGA."
    : 'Unknown error!'

    return new self.Response(
      new self.Blob([
        errorKind, '\n', error.stack || error,
        '\n\nYou can report this issue here: https://github.com/qgustavor/direct-mega/issues',
        '\n\nYou can also try loading it directly in MEGA: ', requiredFile,
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
