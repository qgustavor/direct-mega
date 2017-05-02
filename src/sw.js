/* eslint-env serviceworker */

import { File } from 'megajs/dist/main.browser-es.js'
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
<title>"${escapeHTML(file.name)}" folder contents</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{margin:20px;line-height:1.6;font-size:18px;color:#444;padding:0 10px}h1,h2,h3{line-height:1.2}</style>
<h1>"${escapeHTML(file.name)}" folder contents</h1>
<ul>${file.children.sort((left, right) => {
  return (left.name || '').localeCompare(right.name || '')
}).map(file => {
  return `<li><a href="${escapeHTML(baseURL + '!' + file.downloadId[1])}">${escapeHTML(file.name)}</a></li>`
}).join('\n')}</ul>`

        const response = new self.Response(folderContent, { headers: {
          'Content-Type': 'text/html',
          'Content-Security-Policy': 'sandbox'
        }})
        resolve(response)
        return
      }

      const headers = {}
      headers['Content-Length'] = file.size

      if (isView) {
        headers['Content-Security-Policy'] = 'default-src none ' + requestURL + '; sandbox'
        headers['Content-Disposition'] = 'inline; filename=' + file.name
        headers['Content-Type'] = mime.contentType(file.name)
      } else {
        headers['Content-Disposition'] = 'attachment; filename=' + file.name
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
    const fileNotFound = error.message && error.message.includes('ENOENT (-9)')

    if (!fileNotFound) {
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

    if (fileNotFound) {
      // From HTML5 Boilerplate
      return new self.Response(
        new self.Blob([`<!doctype html><html lang=en><head><meta charset=utf-8><title>File Not Found</title><meta name=viewport content="width=device-width, initial-scale=1">
<style>*{line-height:1.2;margin:0}html{color:#888;display:table;font-family:sans-serif;height:100%;text-align:center;width:100%}body{display:table-cell;vertical-align:middle;margin:2em auto}h1{color:#555;font-size:2em;font-weight:400}p{margin:0 auto;width:280px}@media only screen and (max-width:280px){body,p{width:95%}h1{font-size:1.5em;margin:0 0 .3em}}</style></head><body><h1>File Not Found</h1><p>Sorry, but the file you were trying to ${isView ? 'view' : 'download'} does not exist.</p></body></html>`]),
        {status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' }}
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
        '\n\nYou can report this issue here: https://github.com/qgustavor/direct-mega/issues/new'
      ]),
      {status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' }}
    )
  })
  // If 'main.js' is requested then the worker wasn't ready yet...
  : parsedURL.pathname.includes('/main.js')
  ? new self.Response(new self.Blob(['setTimeout(()=>location.reload(),100)'], {type: 'application/javascript'}))
  // Service Worker is installed but no file was requested, redirect to help page:
  : self.Response.redirect('https://github.com/qgustavor/direct-mega#direct-mega')

  event.respondWith(response)
}
