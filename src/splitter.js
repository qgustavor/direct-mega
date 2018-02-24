import { File } from 'megajs'
import bytes from 'bytes'

const form = document.getElementsByTagName('form')[0]
form.addEventListener('submit', handleSubmit)

if (window.location.hash.match(/mega(\.co)?\.nz/)) {
  form.elements.url.value = window.location.hash.substr(1)
}

const output = document.getElementsByTagName('output')[0]

function handleSubmit (evt) {
  evt.preventDefault()

  const url = form.elements.url.value.trim()
    // Accept URLs without protocol
    .replace(/^(?!https?:\/\/)/i, 'https://')
    // Accept Direct MEGA URL input
    .replace(/https?:\/\/directme.ga\/(?:view)?[?#]([^&]+)/i, 'https://mega.nz/#$1')
    // Normalize mega.co.nz to mega.nz
    .replace('https://mega.co.nz/', 'https://mega.nz/')

  const size = bytes.parse(form.elements.size.value.trim())

  // Show that's possible loading from the hash
  window.location.hash = url

  output.textContent = 'Loading file info...'

  splitFromURL(url, size).then(result => {
    if (!result.parts) {
      output.innerHTML = `This file is smaller than the part size. You can download it by this URL:<br>
      <a href="${result.base}">${result.base}</a>`
      return
    }
    // Based on https://stackoverflow.com/a/19883965 Win64 should be uncommon, but Firefox uses it
    const isWindows = navigator.platform === 'Win32' || navigator.platform === 'Win64' || navigator.platform === 'Windows'
    const mergerName = `merge-${result.id}.${isWindows ? 'bat' : 'sh'}`
    const merger = isWindows
      ? `copy /b ${result.names.join('+')} "${result.name}"`
      : `cat ${result.names.join(' ')} "${result.name}"`
    output.innerHTML = `<p>Download all those links. Between downloading one file and other change your IP.
After downloading all files run "${mergerName}" to join those in a single file.<br>
<ul>${result.parts.map(e => `<li><a href="${e}">${e}</a></li>`).join('')}<li>
<a href="data:application/octet-stream,${encodeURIComponent(merger)}" download="${mergerName}">${mergerName}</a>
<details><summary><small>(if you prefer you can run the command manually in ${isWindows ? 'cmd' : 'bash'})</small></summary><pre>${merger}</pre></details>
</li></ul>After joining the parts you can delete the temporary files.`
  }).catch(error => {
    output.innerHTML = `<b>An error happened:</b><br>
<pre>${error.stack}</pre>`
  })
}

function splitFromURL (url, size) {
  return new Promise((resolve, reject) => {
    const root = File.fromURL(url)
    root.loadAttributes((error, node) => {
      if (error) return reject(error)

      resolve(node.directory
      ? splitFolder(url, node, size)
      : splitFile(url, node, size))
    })
  })
}

function splitFolder (url, folder, partSize) {
  throw Error('Folder splitting is not implemented')
}

function splitFile (url, file, partSize) {
  const parts = []
  const names = []
  let start = 0
  const name = file.name
  const base = url.replace(
    /https?:\/\/mega(\.co)?\.nz\/#/i,
    'https://directme.ga/#'
  )
  const id = Array.isArray(file.downloadId)
    ? file.downloadId[0]
    : file.downloadId

  if (file.size < partSize) {
    return {base}
  }

  while (true) {
    const end = start + partSize - 1
    const partName = `${id}-${parts.length}.part`
    const url = `${base}&name=${partName}&start=${start}`
    names.push(partName)

    if (end > file.size) {
      parts.push(url)
      break
    } else {
      parts.push(`${url}&end=${end}`)
      start = end + 1
    }
  }

  return {parts, names, name, id}
}
