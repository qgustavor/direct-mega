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
  if (!requestURL.includes(location.origin)) return

  const parsedURL = new self.URL(requestURL)
  const identifier = (parsedURL.search || '').substr(1)
  const hasFile = identifier.startsWith('!') || identifier.startsWith('F!')
  const requiredFile = hasFile && `https://mega.nz/#${identifier}`

  const response = requiredFile
  ? (new Promise((resolve, reject) => {
    const file = File.fromURL(requiredFile)
    file.loadAttributes((err, file) => {
      if (err) return reject(err)

      if (file.children) {
        const folderContent = `<!DOCTYPE html><meta charset="utf-8">
<title>"${escapeHTML(file.name)}" folder contents</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{margin:20px;line-height:1.6;font-size:18px;color:#444;padding:0 10px}h1,h2,h3{line-height:1.2}</style>
<h1>"${escapeHTML(file.name)}" folder contents</h1>
<ul>${file.children.map(file => {
  return `<li><a href="${escapeHTML(requestURL + '!' + file.downloadId[1])}">${escapeHTML(file.name)}</a></li>`
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

      if (parsedURL.pathname.includes('/view')) {
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
    setTimeout(() => {
      // Rollbar JavaScript API isn't compatible with Service Workers, so we're using the JSON API
      self.fetch('https://api.rollbar.com/api/1/item/', {
        method: 'POST',
        body: JSON.stringify({
          'access_token': 'e7dce51c0e174102bad8179a5c5680ac',
          'data': {
            'environment': 'production',
            'platform': 'browser',
            'body': {
              'message': {
                'body': error.stack || error
              }
            }
          }
        })
      })
    }, 100)

    return new self.Response(
      new self.Blob([
        'Unknown error!\n', error.stack || error,
        '\n\nReport issue here: https://github.com/qgustavor/direct-mega/issues/new'
      ]),
      {headers: { 'Content-Type': 'text/plain; charset=utf-8' }}
    )
  })
  // If 'main.js' is requested then the worker wasn't ready yet...
  : parsedURL.pathname.includes('/main.js')
  ? new Response(new Blob(['setTimeout(()=>location.reload(),100)'], {type: 'application/javascript'}))
  : self.Response.redirect('https://github.com/qgustavor/direct-mega/blob/gh-pages/README.md#direct-mega')

  event.respondWith(response)
}
