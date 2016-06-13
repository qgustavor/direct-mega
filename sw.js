// Source from sw.min.js
// Build using rollup.js

// 'mega' module is the fork of mine
// https://github.com/qgustavor/mega

import mega from 'mega'
import {parse} from 'url'

self.addEventListener('install', function (event) {
  // Try to make an stream, if it fails the SW don't install
  new ReadableStream();
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function(event) {
  const identifier = (parse(event.request.url).search || '').substr(1);
  const requiredFile = identifier.charAt(0) === '!' ?
    `https://mega.nz/#${ identifier }` : null;
  
  const promise = requiredFile ? (new Promise((resolve, reject) => {
    const file = mega.file(requiredFile);
    file.loadAttributes((err, attr) => {
      if (err) return reject(err);
      
      const headers = {};
      headers['Content-Disposition'] = 'attachment; filename=' + attr.name;
      headers['Content-Type'] = 'application/octet-stream; charset=utf-8';
      headers['Content-Length'] = attr.size;
    
      const stream = file.download();
      
      resolve(new Response(new ReadableStream({
        start: controller => {
          stream.on('data', data => controller.enqueue(new Uint8Array(data)))
          stream.on('end', () => controller.close())
        },
        cancel: () => {
          stream.emit('close');
        }
      }), {headers: headers}));
    });
  })) : Response.redirect('https://github.com/qgustavor/direct-mega/blob/gh-pages/README.md#direct-mega');
    
  event.respondWith(promise.catch(err => {
    setTimeout(() => {
      fetch('https://api.rollbar.com/api/1/item/', {
        method: 'POST',
        body: JSON.stringify({
        "access_token": "e7dce51c0e174102bad8179a5c5680ac",
        "data": {
          "environment": "production",
          "platform": "browser",
          "body": {
            "message": {
              "body": err.stack
            }
          }
        }
      })});
    }, 100);
    return new Response(
      new Blob(['Unknown error!\n', err.stack,
        '\n\nReport issue here: https://github.com/qgustavor/direct-mega/issues/new']),
      {headers: { 'Content-Type': 'text/plain; charset=utf-8' }}
    );
  }));
});
