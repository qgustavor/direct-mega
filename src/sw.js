/* eslint-env serviceworker */

import { File } from 'megajs/dist/main.browser-es.js'

self.addEventListener('install', function (event) {
  // Try to make an stream, if it fails the SW will not install
  const stream = new self.ReadableStream()
  event.waitUntil(stream && self.skipWaiting())
})

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', function (event) {
  const identifier = (new self.URL(event.request.url).search || '').substr(1)
  const requiredFile = identifier.charAt(0) === '!'
    ? `https://mega.nz/#${identifier}` : null

  const promise = requiredFile ? (new Promise((resolve, reject) => {
    const file = File.fromURL(requiredFile)
    file.loadAttributes((err, file) => {
      if (err) return reject(err)

      const headers = {}
      headers['Content-Disposition'] = 'attachment; filename=' + file.name
      headers['Content-Type'] = 'application/octet-stream; charset=utf-8'
      headers['Content-Length'] = file.size

      const stream = file.download()

      resolve(new self.Response(new self.ReadableStream({
        start: controller => {
          stream.on('data', data => controller.enqueue(new Uint8Array(data)))
          stream.on('end', () => controller.close())
        },
        cancel: () => {
          stream.emit('close')
        }
      }), { headers }))
    })
  })) : self.Response.redirect('https://github.com/qgustavor/direct-mega/blob/gh-pages/README.md#direct-mega')

  event.respondWith(promise.catch(error => {
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
  }))
})
