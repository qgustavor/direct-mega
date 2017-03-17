import { File } from 'megajs/dist/main.browser-es.js'

const location = window.location
const body = document.body
let url = null

function handleFallback () {
  if (location.pathname.indexOf('/view') !== -1) {
    showMessage("Viewing files isn't supported in this browser.")

    const paragraph = document.createElement('p')
    paragraph.appendChild(document.createTextNode('You can '))
    const anchor = document.createElement('a')
    anchor.href = location.href.replace('/view', '/')
    anchor.textContent = 'download it'
    paragraph.appendChild(anchor)
    paragraph.appendChild(document.createTextNode('.'))
    body.appendChild(paragraph)

    return
  }

  const identifier = (location.hash.length > 2 ? location.hash : location.search || '').substr(1)
  url = 'https://mega.nz/#' + identifier

  let file

  try {
    file = File.fromURL(url)
  } catch (error) {
    showError(error.message)
    return
  }

  file.loadAttributes(afterLoadAttributes)
}

function afterLoadAttributes (error, file) {
  if (error) {
    showError(error.message)
    return
  }

  showMessage('"' + file.name + '" opened')

  if (file.children) {
    showMessage("For now folders can't be downloaded. Select a file from the list below:")

    const baseURL = location.origin + location.pathname + '?' + identifier.split('!').slice(0, 3).join('!')
    let fileList = document.createElement('ul')
    file.children.sort((left, right) => {
      return (left.name || '').localeCompare(right.name || '')
    }).forEach(file => {
      const listItem = document.createElement('li')
      const link = document.createElement('a')
      link.href = baseURL + '!' + file.downloadId[1]
      link.textContent = file.name
      listItem.appendChild(link)
      fileList.appendChild(listItem)
    })

    body.appendChild(fileList)
    return
  }

  const downloadStream = file.download((err, data) => {
    afterDownload(err, data, file)
  })
  handleProgress(downloadStream, file.size)
}

function handleProgress (stream, total) {
  const progressElement = document.createElement('p')
  progressElement.textContent = '0%'

  stream.on('progress', function (data) {
    progressElement.textContent = Math.floor(data.bytesLoaded * 100 / total) + '%'
  })

  stream.on('end', function () {
    progressElement.textContent = '100%'
  })
}

function afterDownload (error, data, file) {
  if (error) {
    showError(error.message)
    return
  }

  const paragraph = document.createElement('p')

  paragraph.appendChild(document.createTextNode('Your download should be starting soon.'))
  paragraph.appendChild(document.createElement('br'))
  paragraph.appendChild(document.createTextNode('If it dont starts '))

  const anchor = document.createElement('a')
  anchor.href = window.URL.createObjectURL(new window.Blob([data.buffer || data], { type: 'application/octet-stream' }))
  anchor.download = file.name
  anchor.textContent = 'click here'
  paragraph.appendChild(anchor)

  paragraph.appendChild(document.createTextNode('.'))

  body.appendChild(paragraph)
  anchor.click()
}

function showMessage (message) {
  let paragraph = document.createElement('p')
  paragraph.textContent = message
  body.appendChild(paragraph)
}

function showError (error) {
  showMessage(error)

  const paragraph = document.createElement('p')
  body.appendChild(paragraph)

  paragraph.appendChild(document.createTextNode('You can '))

  let anchor = document.createElement('a')
  anchor.textContent = 'open a issue reporting this error'
  anchor.href = 'https://github.com/qgustavor/direct-mega/issues/new'
  paragraph.appendChild(anchor)
  paragraph.appendChild(document.createElement('br'))

  paragraph.appendChild(document.createTextNode(' or '))

  anchor = document.createElement('a')
  anchor.textContent = 'try the original MEGA'
  anchor.href = url
  paragraph.appendChild(anchor)

  paragraph.appendChild(document.createTextNode('.'))
}

// start fallback script
handleFallback()
