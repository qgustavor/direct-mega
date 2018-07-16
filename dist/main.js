;(function () {
  var header = document.createElement('h1')
  header.textContent = 'Direct MEGA'
  document.body.appendChild(header)

  var installingMessage = document.createElement('p')
  installingMessage.textContent = 'Please wait...'
  window.installingMessage = installingMessage
  document.body.appendChild(installingMessage)

  var location = window.location
  var identifier = (location.hash.length > 2 ? location.hash : location.search || '').substr(1)
  var hasFile = identifier.startsWith('!') || identifier.startsWith('F!')

  var compatible = typeof ReadableStream === 'function' &&
    // Issue #17: Safari 11.1 downloads the HTML page instead of the Worker generated response
    // It's impossible to detect using feature detection, so user agent sniffing is used
    !navigator.userAgent.includes('Version/11.1 Safari')

  if (compatible) {
    try {
      ;(new window.ReadableStream()).getReader().read()
    } catch (e) {
      compatible = false
    }
  }

  if (navigator.serviceWorker && compatible) {
    navigator.serviceWorker.register('sw.js', {scope: '.'})
      .then(navigator.serviceWorker.ready)
      .then(function () {
        if (hasFile) {
          location.href = location.pathname + '?' + identifier
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
    script.onerror = handleFallbackError
    document.head.appendChild(script)
  }
  function handleFallbackError () {
    var errorMessage = document.createElement('p')
    errorMessage.textContent = 'An error happened while loading. Check your network connection and try again.'
    document.body.appendChild(errorMessage)
  }
}())
