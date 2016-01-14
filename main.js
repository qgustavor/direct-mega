(function () {
  var output = document.getElementById('output');
  // For future translation
  var messages = [
    'Incompatible browser, loading fallback',
    'No file defined :/',
    'After the download starts you can now close this window.',
    'Unknown error, loading fallback',
    'Try MEGA directly',
    'Report issue',
    'Click here to finish download if it not starts automatically',
    'Unknown error',
    'Downloading $1 ($2)',
  ];
  
  var href = 'https://mega.nz' + (location.hash.length > 2 ? location.hash : ('#' + (location.search || '').substr(1)));

  if (!navigator.serviceWorker) {
    showMessage(messages[0], true);
    loadFallback();
    return;
  }
  
  navigator.serviceWorker.register('sw.min.js', {scope: '.'})
  .then(navigator.serviceWorker.ready)
  .then(function afterReady(instance){
    if (!instance.active || location.search.length > 2) {
      location.reload();
      return;
    }
    
    if (location.hash.length <= 1) {
      showMessage(messages[1], true);
      return;
    }
    
    sendMessage(instance.active, href).then(function (data) {
      location.href = './?' + data.identifier;
      showMessage(messages[2], true);
    });
  }, function (error) {
    console.error(error);
    showMessage(messages[3], true);
    loadFallback();
  });
  
  function loadFallback() {
    var script = document.createElement('script');
    var file;
    var attributes;
    script.src = 'mega.js';
    script.onload = function() {
      file = mega.file(href);
      file.loadAttributes(afterLoadAttributes);
    };
    
    function afterLoadAttributes(err, data) {
      attributes = data;
      if (err) {
        showMessage(messages[7]);
        throw err;
      }
      showMessage(messages[8]
        .replace('$1', attributes.name)
        .replace('$2', humanizeSize(attributes.size)), true);
      file.download(afterDownload);
    }
    
    function afterDownload(err, data) {
      if (err) {
        showMessage(messages[7]);
        throw err;
      }
      var anchor = document.createElement('a');
      anchor.textContent = messages[6];
      anchor.href = URL.createObjectURL(new Blob(new Uint8Array(data /* is Buffer */)));
      anchor.download = attributes.name;
      showMessage('', true);
      output.appendChild(anchor);
      anchor.click();
    }
    
    document.head.appendChild(script)
  }
  
  function humanizeSize(a,b,c,d,e) { // http://stackoverflow.com/a/20463021
    return (b = Math, c = b.log, d = 1024, e = c(a)/c(d)|0, a/b.pow(d,e)).toFixed(2)+' '+(e?'KMGTPEZY'[--e]+'B':'bytes');
  }
  
  function showMessage(message, noError) {
    output.textContent = message;
    output.appendChild(document.createElement('br'));
    
    if (noError) return;
    
    var anchor = document.createElement('a');
    anchor.textContent = messages[4];
    anchor.href = href;
    output.appendChild(anchor);
    output.appendChild(document.createElement('br'));
    
    anchor = document.createElement('a');
    anchor.textContent = messages[5];
    anchor.href = 'https://github.com/qgustavor/direct-mega/issues/new';
    output.appendChild(anchor);
  }
  
  // https://googlechrome.github.io/samples/service-worker/post-message/
  function sendMessage(instance, message) {
    return new Promise(function(resolve, reject) {
      var messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = function(event) {
        if (event.data.error) {
          reject(event.data.error);
        } else {
          resolve(event.data);
        }
      };
      
      instance.postMessage(message, [messageChannel.port2]);
    });
  }
}());