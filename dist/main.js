(function () {
  var header = document.createElement('h1')
  header.textContent = 'Direct MEGA'
  document.body.appendChild(header)

  var installingMessage = document.createElement('p')
  installingMessage.textContent = 'Please wait...'
  document.body.appendChild(installingMessage)

  var location = window.location
  var identifier = (location.hash.length > 2 ? location.hash : location.search || '').substr(1)
  var hasFile = identifier.length < 4

  if (navigator.serviceWorker && typeof ReadableStream === 'function') {
    navigator.serviceWorker.register('sw.js', {scope: '.'}).then(function () {
      if (hasFile) {
        location.reload()
      } else {
        location.href = 'https://github.com/qgustavor/direct-mega#direct-mega'
      }
    }, fallback)
  } else if (hasFile) {
    fallback()
  } else {
    location.href = 'https://github.com/qgustavor/direct-mega#direct-mega'
  }
  function fallback () {
    var script = document.createElement('script')
    script.src = 'fallback.js'
    document.head.appendChild(script)
  }
}())
