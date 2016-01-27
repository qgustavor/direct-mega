(function () {
  var output = document.getElementById('output');
  // For future translation
  var messages = [
    "Cannot use browser download manager. Using alternative download manager.",
    'Direct MEGA installed, but no file to download.',
    'After the download starts you can close this window.',
    'Unknown error. Using alternative download manager.',
    'Try the original',
    'Report issue',
    'Click here to download if it not starts automatically',
    'Unknown error',
    "Downloading $1 ($2) - don't close this page",
    'Your download will start soon...',
    'No file to download.',
  ];
  
  var identifier = (location.hash.length > 2 ? location.hash : location.search || '').substr(1);
  var href = 'https://mega.nz/#' + identifier;

  if (!navigator.serviceWorker) {
    if (identifier.length < 4) {
      showMessage(messages[10], true);
      return;
    }
    showMessage(messages[0], true);
    loadFallback();
    return;
  }
  
  navigator.serviceWorker.register('sw.min.js', {scope: '.'})
  .then(navigator.serviceWorker.ready)
  .then(function (instance){
    if (identifier.length < 4) {
      showMessage(messages[1], true);
      return;
    }
    
    var isDownloadIframe = false;
    try {
      isDownloadIframe = parent !== self && // is in a iframe and is the iframe created below
      parent.location.origin === location.origin;
    } catch(e) {}
    
    if (isDownloadIframe) {
      if (instance.active && instance.active.state === 'activating') {
        setTimeout(function () {
          location.reload();
        }, 500);
        return;
      }
      
      top.postMessage('', location.origin);
      return;
    }

    showMessage(messages[9], true);
    
    var downloadFrame = document.createElement('iframe');
    downloadFrame.src = '?' + identifier;
    downloadFrame.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;' +
      'margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0';
    
    var canCloseTimeout = setTimeout(function() {
      showMessage(messages[2], true);
    }, 8000);
    window.addEventListener('message', function(event) {
      if (event.origin !== location.origin) return;
      clearTimeout(canCloseTimeout);
      showMessage(messages[3], true);
      loadFallback();
    });
    
    document.body.appendChild(downloadFrame);
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
        
      handleProgress(file.download(afterDownload), attributes.size);
    }
    
    function handleProgress(stream, total) {
      var percentageBar = document.getElementsByClassName('downloading-progress-bar')[0];
      var percentageText = document.getElementsByClassName('percentage')[0];
      document.getElementsByClassName('downloader')[0].className += ' active';
      
      percentageText.textContent = '0%';
      
      stream.on('progress', function (data) {
        percentageText.textContent = Math.floor(data.bytesLoaded * 100 / total) + '%';
        percentageBar.style.width = (data.bytesLoaded * 100 / total).toFixed(2) + '%';
      });
      
      stream.on('end', function () {
        percentageText.textContent = percentageBar.style.width = '100%';
      });
    }
    
    function afterDownload(err, data) {
      if (err) {
        showMessage(messages[7]);
        throw err;
      }
      var anchor = document.createElement('a');
      anchor.textContent = messages[6];
      
      // data is Uint8Array
      anchor.href = URL.createObjectURL(new Blob([data.buffer || data], { type: 'application/octet-stream' }));
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
}());