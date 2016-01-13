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
    'Download fishished',
    'Unknown error'
  ];
  
  var href = 'https://mega.nz' + location.hash;

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
    script.src = 'mega.js';
    script.onload = function() {
      file = mega.file(href);
      file.loadAttributes(afterLoadAttributes);
    };
    
    function afterLoadAttributes(err, data) {
      if (err) {
        showMessage(messages[7]);
        throw err;
      }
      file.download(afterDownload);
    }
    
    function afterDownload(err, data) {
      if (err) {
        showMessage(messages[7]);
        throw err;
      }
      var anchor = document.createElement('a');
      anchor.textContent = messages[6];
      anchor.href = URL.createObjectURL(new Blob(data));
      showMessage('', true);
      output.appendChild(anchor);
    }
    
    document.head.appendChild(script)
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