(function () {
  'use strict'

  var buckets = null

  function apiJson(method, url, body) {
    return m
      .request({ method: method, url: url, body: body })
      .catch(function (err) {
        var msg =
          err && err.response && err.response.error
            ? err.response.error
            : err && err.message
              ? err.message
              : 'Request failed'
        throw new Error(msg)
      })
  }

  function getBuckets() {
    if (buckets) return Promise.resolve(buckets)
    return apiJson('GET', '/v1/buckets').then(function (data) {
      buckets = data.buckets || []
      return buckets
    })
  }

  function formatSize(bytes) {
    if (!isFinite(bytes)) return '-'
    return (bytes / 1048576).toFixed(2) + ' MiB'
  }

  function formatDate(iso) {
    var d = new Date(iso)
    return isNaN(d.getTime()) ? iso : d.toLocaleString()
  }

  function alertView(message) {
    return m('div.alert.alert-error', { role: 'alert' }, message)
  }

  function tableSkeleton(count) {
    var rows = []
    for (var i = 0; i < count; i++) {
      rows.push(m('tr', m('td', { colspan: 3 }, m('div.skeleton.h-6.w-full'))))
    }
    return rows
  }

  var NotFound = {
    oninit: function (vnode) {
      var rest = vnode.attrs.bucket || ''
      if (rest.length && rest.charAt(rest.length - 1) === '/') {
        var target = window.location.pathname.replace(/\/+$/, '') || '/'
        m.route.set(target)
        return
      }
      document.title = 'Not Found'
    },
    view: function () {
      return m('div.alert.alert-error', { role: 'alert' }, [
        m('span', 'Not Found'),
        m(m.route.Link, { href: '/', class: 'link link-hover' }, 'Back to buckets'),
      ])
    },
  }

  var BucketList = {
    oninit: function (vnode) {
      var state = vnode.state
      state.loading = true
      state.error = null
      state.list = []
      document.title = 'Showcase'
      getBuckets()
        .then(function (list) {
          state.loading = false
          state.list = list
          m.redraw()
        })
        .catch(function (err) {
          state.loading = false
          state.error = err
          m.redraw()
        })
    },
    view: function (vnode) {
      var state = vnode.state
      return m('div', [
        m(
          'div.mb-4.flex.items-center.gap-2.text-2xl.font-bold',
          m(m.route.Link, { href: '/', class: 'link link-hover' }, 'Buckets'),
        ),
        state.loading
          ? m('div.overflow-x-auto', m('table.table.table-zebra', tableSkeleton(4)))
          : null,
        state.error ? alertView(state.error.message) : null,
        !state.loading && !state.error
          ? state.list.length
            ? m(
                'div.overflow-x-auto',
                m('table.table.table-zebra', [
                  m(
                    'thead',
                    m('tr', [m('th', 'Name')]),
                  ),
                  m(
                    'tbody',
                    state.list.map(function (bucket) {
                      return m(
                        'tr',
                        m(
                          'td',
                          m(m.route.Link, { href: '/' + encodeURIComponent(bucket), class: 'link' }, bucket),
                        ),
                      )
                    }),
                  ),
                ]),
              )
            : m('div.alert', 'No buckets')
          : null,
      ])
    },
  }

  var BucketPage = {
    oninit: function (vnode) {
      var state = vnode.state
      state.bucket = vnode.attrs.bucket
      state.prefix = ''
      state.cursor = null
      state.items = []
      state.loading = false
      state.error = null
      state.ready = false
      state.notFound = false
      state.uploads = []
      state.uploadSeq = 0
      document.title = state.bucket

      getBuckets()
        .then(function (list) {
          if (list.indexOf(state.bucket) === -1) {
            state.notFound = true
            document.title = 'Not Found'
            m.redraw()
            return
          }
          state.ready = true
          load(vnode)
          m.redraw()
        })
        .catch(function (err) {
          state.error = err
          m.redraw()
        })
    },
    view: function (vnode) {
      var state = vnode.state
      if (state.notFound) return m(NotFound)

      var tableBody =
        !state.ready || (state.loading && !state.cursor)
          ? tableSkeleton(5)
          : bodyRows(state)

      return m('div', [
        m('div.mb-4.flex.items-center.gap-2.text-2xl.font-bold', [
          m(m.route.Link, { href: '/', class: 'link link-hover' }, 'Buckets'),
          m('span.opacity-40', '>'),
          m('span', state.bucket),
        ]),
        state.error
          ? m('div.mb-4', alertView(state.error.message))
          : null,
        m('div.mb-4.flex.items-center.justify-between.gap-2', [
          m('input.input.w-full.max-w-sm', {
            type: 'text',
            placeholder: 'filter',
            oninput: function (e) {
              debounceInput(vnode, e.target.value)
            },
          }),
          m('button.btn', { onclick: function () { if (state.fileInput) state.fileInput.click() } }, 'Upload'),
          m('input', {
            type: 'file',
            multiple: true,
            class: 'hidden',
            oncreate: function (v) { state.fileInput = v.dom },
            onchange: function (e) {
              var files = e.target.files
              if (files && files.length) uploadFiles(vnode, files)
              e.target.value = ''
            },
          }),
        ]),
        state.uploads.length
          ? m('div.mb-4.flex.flex-col.gap-2', state.uploads.map(uploadRow))
          : null,
        m(
          'div.overflow-x-auto',
          m('table.table.table-zebra', [
            m(
              'thead',
              m('tr', [
                m('th', 'Key'),
                m('th.text-right', 'Size'),
                m('th', 'Last modified'),
              ]),
            ),
            m('tbody', tableBody),
          ]),
        ),
        m(
          'div.flex.justify-center.pt-4',
          state.cursor && !state.loading
            ? m('button.btn', { onclick: function () { loadMore(vnode) } }, 'Load more')
            : null,
        ),
      ])
    },
  }

  function bodyRows(state) {
    if (!state.items.length) {
      return [
        m(
          'tr',
          m(
            'td.py-8.text-center.text-base-content/60',
            { colspan: 3 },
            'No objects',
          ),
        ),
      ]
    }
    return state.items.map(function (item) {
      return m('tr', [
        m('td.break-all.font-mono', item.key),
        m('td.text-right.tabular-nums', formatSize(item.size)),
        m('td', formatDate(item.lastModified)),
      ])
    })
  }

  function debounceInput(vnode, value) {
    var state = vnode.state
    if (state.timer) clearTimeout(state.timer)
    state.timer = setTimeout(function () {
      state.prefix = value
      state.cursor = null
      state.items = []
      state.error = null
      load(vnode)
    }, 500)
  }

  function loadMore(vnode) {
    load(vnode)
  }

  function uploadFiles(vnode, fileList) {
    var state = vnode.state
    Array.prototype.slice.call(fileList).forEach(function (file) {
      var entry = {
        id: ++state.uploadSeq,
        name: file.name,
        progress: 0,
        status: 'uploading',
      }
      state.uploads.push(entry)
      uploadFile(vnode, entry, file)
    })
    m.redraw()
  }

  function uploadFile(vnode, entry, file) {
    var state = vnode.state
    var url = '/v1/buckets/' + encodeURIComponent(state.bucket) + '/uploads'
    apiJson('POST', url, {
      key: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
    })
      .then(function (data) {
        if (data.mode === 'simple') {
          return putWithProgress(data.url, file, entry)
        }
        return uploadMultipart(vnode, data, file, entry)
      })
      .then(function () {
        entry.status = 'done'
        entry.progress = 100
        m.redraw()
        refreshList(vnode)
        dismissUpload(state, entry)
      })
      .catch(function (err) {
        entry.status = 'error'
        entry.error = err.message
        m.redraw()
        dismissUpload(state, entry)
      })
  }

  function dismissUpload(state, entry) {
    setTimeout(function () {
      var idx = state.uploads.indexOf(entry)
      if (idx !== -1) {
        state.uploads.splice(idx, 1)
        m.redraw()
      }
    }, 3000)
  }

  function putWithProgress(url, file, entry) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest()
      xhr.open('PUT', url)
      xhr.upload.onprogress = function (e) {
        if (e.lengthComputable) {
          entry.progress = Math.round((e.loaded / e.total) * 100)
          m.redraw()
        }
      }
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) resolve()
        else reject(new Error('Upload failed (' + xhr.status + ')'))
      }
      xhr.onerror = function () {
        reject(new Error('Upload failed'))
      }
      xhr.send(file)
    })
  }

  function uploadMultipart(vnode, data, file, entry) {
    var state = vnode.state
    var partSize = data.partSize
    var uploadUrl =
      '/v1/buckets/' + encodeURIComponent(state.bucket) + '/uploads/' + encodeURIComponent(data.uploadId)
    var pending = data.parts.slice()
    var parts = []

    function uploadNext() {
      if (!pending.length) return Promise.resolve()
      var part = pending.shift()
      var start = (part.partNumber - 1) * partSize
      var blob = file.slice(start, start + partSize)
      return fetch(part.url, { method: 'PUT', body: blob }).then(function (res) {
        if (!res.ok) throw new Error('Part ' + part.partNumber + ' failed (' + res.status + ')')
        var etag = res.headers.get('ETag')
        if (!etag) throw new Error('Part ' + part.partNumber + ' missing ETag')
        parts.push({ partNumber: part.partNumber, etag: etag })
        entry.progress = Math.round((parts.length / data.parts.length) * 100)
        m.redraw()
        return uploadNext()
      })
    }

    return uploadNext()
      .then(function () {
        return apiJson('POST', uploadUrl + '/complete', { key: data.key, parts: parts })
      })
      .catch(function (err) {
        apiJson('DELETE', uploadUrl, { key: data.key }).catch(function () {})
        throw err
      })
  }

  function uploadRow(entry) {
    var status
    if (entry.status === 'uploading') {
      status = m('progress.progress.w-40', { value: entry.progress, max: 100 })
    } else if (entry.status === 'done') {
      status = m('span.badge.badge-success', 'Done')
    } else {
      status = m('div.text-sm.text-error', entry.error || 'Failed')
    }
    return m('div.flex.items-center.gap-3', [
      m('div.min-w-0.flex-1.truncate.text-sm', entry.name),
      status,
    ])
  }

  function refreshList(vnode) {
    var state = vnode.state
    state.items = []
    state.cursor = null
    load(vnode)
  }

  function load(vnode) {
    var state = vnode.state
    if (state.loading) return
    state.loading = true
    state.error = null
    var cursor = state.cursor
    var url =
      '/v1/buckets/' + encodeURIComponent(state.bucket) + '/objects?limit=100'
    if (state.prefix) url += '&prefix=' + encodeURIComponent(state.prefix)
    if (cursor) url += '&cursor=' + encodeURIComponent(cursor)
    apiJson('GET', url)
      .then(function (data) {
        state.loading = false
        var items = data.items || []
        state.items = cursor ? state.items.concat(items) : items
        state.cursor = data.nextCursor || null
      })
      .catch(function (err) {
        state.loading = false
        state.error = err
      })
  }

  var navHome = document.querySelector('.navbar a')
  if (navHome) {
    navHome.addEventListener('click', function (e) {
      e.preventDefault()
      m.route.set('/')
    })
  }

  m.route.prefix = ''
  m.route(document.getElementById('app'), '/', {
    '/': BucketList,
    '/:bucket': BucketPage,
    '/:bucket...': NotFound,
  })
})()
