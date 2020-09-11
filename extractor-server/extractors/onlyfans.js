;(function(appToken) {
    let ws = new WebSocket('ws://localhost:8080')
    let files = []
    ws.onopen = async () => {
        const creator = await getCreatorInfo()
        const zipId = (await openZip(ws, `onlyfans_${creator.username.replace(/\//, '-')}`)).zipId

        await extractFromCurrentOnlyfansPage(ws, zipId, creator)
        await closeZip(ws, zipId)
        ws.close()
    }
    ws.addEventListener('message', async (message) => {
        const parsedMessage = JSON.parse(message.data)
        if (parsedMessage.type === 'ping') {
            heartbeat(ws, parsedMessage)
        }
    })

    async function getCreatorInfo() {
        console.log("Downloading creator info")
        let creator = await new Promise((resolve, reject) => {
            let xhr = new XMLHttpRequest()
            xhr.onreadystatechange = () => {
                if (xhr.readyState == 4) {
                    if (xhr.status < 400) {
                        resolve(JSON.parse(xhr.responseText))
                    } else {
                        reject()
                    }
                }
            }
            xhr.open('GET', `https://onlyfans.com/api2/v2/users${location.pathname}?app-token=${appToken}`)
            xhr.setRequestHeader('Accept', 'application/json')
            xhr.send()
        })
        console.log("Finished downloading creator info")
        return creator
    }

    async function extractFromCurrentOnlyfansPage(ws, zipId, creator) {
        let nextUrl = `https://onlyfans.com/api2/v2/users/${creator.id}/posts?limit=10&order=publish_date_desc&skip_users=all&skip_users_dups=1&pinned=0&app-token=${appToken}`
        let data = []
        
        console.log("Downloading posts info")
        while (nextUrl != null) {
            let response = await new Promise((resolve, reject) => {
                let xhr = new XMLHttpRequest()
                xhr.onreadystatechange = () => {
                    if (xhr.readyState == 4) {
                        if (xhr.status < 400) {
                            resolve(xhr.responseText)
                        } else {
                            reject()
                        }
                    }
                }
                xhr.open('GET', nextUrl)
                xhr.setRequestHeader('Accept', 'application/json')
                xhr.send()
            })
    
            let responseObj = JSON.parse(response)
            nextUrl = responseObj && responseObj.length >= 10 ? `https://onlyfans.com/api2/v2/users/${creator.id}/posts?limit=10&order=publish_date_desc&skip_users=all&skip_users_dups=1&beforePublishTime=${responseObj[responseObj.length - 1].postedAtPrecise}&pinned=0&app-token=${appToken}` : null
            if (responseObj) {
                data.push(...responseObj)
            }
        }

        let jsonResult = JSON.stringify({
            creator,
            data
        })

        await appendFile(ws, zipId, 'data.json', jsonResult)
        await appendFile(ws, zipId, 'data.json.js', `window.onlyFansData = ${jsonResult}`)
        console.log("Finished downloading posts info")

        console.log("Filter links of files to download")
        let files = []
        addFile(creator.avatar)
        if (creator.avatarThumbs) {
            Object.keys(creator.avatarThumbs).forEach((a) => {
                addFile(creator.avatarThumbs[a])
            })
        }
        addFile(creator.header)
        if (creator.headerThumbs) {
            Object.keys(creator.headerThumbs).forEach((h) => {
                addFile(creator.headerThumbs[h])
            })
        }
        data.forEach(d => {
            d.media.forEach(m => {
                if (m.files) {
                    Object.keys(m.files).forEach((f) => {
                        addFile(m.files[f]?.url)
                    })
                }
                addFile(m.full)
                addFile(m.info?.source?.source)
                addFile(m.preview)
                addFile(m.source?.source)
                addFile(m.squarePreview)
                addFile(m.thumb)
                if (m.videoSources) {
                    Object.keys(m.videoSources).forEach((k) => {
                        addFile(m.videoSources[k])
                    })
                }
            })
        })
        function addFile(f) {
            if (f != null && files.indexOf(f) === -1) {
                files.push(f)
            }
        }

        console.log("Downloading posts files")
        await downloadFiles(ws, zipId, files)
    }

    async function downloadFiles(ws, zipId, urls) {
        const parallelDownloadsCount = 6
        const urlsStack = Array.from(urls)
        const runningPromises = []

        for (let i = 0; i < parallelDownloadsCount && urlsStack.length > 0; i++) {
            runningPromises.push(selfRemovePromise(downloadFile(ws, zipId, urlsStack.splice(0, 1)[0])))
        }

        while (urlsStack.length > 0) {
            await Promise.race(runningPromises)

            let downloadedFiles = urls.length - urlsStack.length
            if (downloadedFiles % 10 === 0) {
                console.log(`Downloaded ${downloadedFiles}/${urls.length} (${Math.round(((100 * downloadedFiles / urls.length) + Number.EPSILON) * 100) / 100}%)`)
            }

            runningPromises.push(selfRemovePromise(downloadFile(ws, zipId, urlsStack.splice(0, 1)[0])))
        }

        await Promise.all(runningPromises)

        console.log(`Downloading finished ${urls.length}/${urls.length} (100%)`)

        function selfRemovePromise(promise) {
            const self = new Promise(resolve => {
                promise.catch(() => {}).then(() => {
                    let indexOf = runningPromises.indexOf(self)
                    if (indexOf !== -1) {
                        runningPromises.splice(indexOf, 1)
                    }
                    resolve()
                })
            })
            return self
        }
    }

    async function downloadFile(ws, zipId, url) {
        let zipUrl = decodeURIComponent(url.replace(/^https?:\/\//, '').replace(/\?(.*)/, ''))
        if (files.indexOf(zipUrl) === -1) {
            if (url.indexOf('https://public.onlyfans.com') >= 0) {
                await appendFileFromUrl(ws, zipId, zipUrl, url)
            } else {
                let response = await new Promise((resolve, reject) => {
                    let xhr = new XMLHttpRequest()
                    xhr.responseType = "arraybuffer"
                    xhr.onreadystatechange = () => {
                        if (xhr.readyState == 4) {
                            if (xhr.status < 400) {
                                resolve(xhr.response)
                            } else {
                                reject()
                            }
                        }
                    }
                    xhr.open('GET', url)
                    xhr.send()
                })
                files.push(zipUrl)

                var responseLength = new Uint8Array(response).byteLength;
                if (responseLength > 500000) {
                    const { fileId } = await openFileStream(ws, zipId, zipUrl)
                    const chunkSize = 500000
                    let offset = 0
                    while (offset < responseLength) {
                        await appendToFileStream(ws, fileId, _arrayBufferToBase64(response, offset, chunkSize), true)
                        offset += chunkSize
                    }
                    await closeFileStream(ws, fileId)
                } else {
                    await appendFile(ws, zipId, zipUrl, _arrayBufferToBase64(response, 0, responseLength), true)
                }
            }
        }
        return zipUrl

        function _arrayBufferToBase64(buffer, start, length) {
            var binary = '';
            var bytes = new Uint8Array(buffer);
            var len = Math.min(bytes.byteLength, start + length);
            for (var i = start; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return window.btoa(binary);
        }
    }

    function openZip(ws, prefix) {
        return new Promise((resolve) => {
            sendMessage(ws, {
                type: 'open-zip',
                prefix: prefix
            }, (data) => resolve(data))
        })
    }
    function closeZip(ws, zipId) {
        return new Promise((resolve) => {
            sendMessage(ws, {
                type: 'end',
                id: zipId
            }, (data) => resolve(data))
        })
    }

    function appendFile(ws, zipId, filePath, fileData, isBase64) {
        return new Promise((resolve) => {
            sendMessage(ws, {
                type: 'append-file',
                id: zipId,
                file: filePath,
                isBase64: !!isBase64,
                content: fileData
            }, (data) => resolve(data))
        })
    }

    function openFileStream(ws, zipId, filePath) {
        return new Promise((resolve) => {
            sendMessage(ws, {
                type: 'open-file-stream',
                id: zipId,
                file: filePath
            }, (data) => resolve(data))
        })
    }

    function appendToFileStream(ws, fileId, fileData, isBase64) {
        return new Promise((resolve) => {
            sendMessage(ws, {
                type: 'append-to-file-stream',
                id: fileId,
                isBase64: !!isBase64,
                content: fileData
            }, (data) => resolve(data))
        })
    }

    function closeFileStream(ws, fileId) {
        return new Promise((resolve) => {
            sendMessage(ws, {
                type: 'close-file-stream',
                id: fileId
            }, (data) => resolve(data))
        })
    }

    function appendFileFromUrl(ws, zipId, filePath, url) {
        return new Promise((resolve) => {
            sendMessage(ws, {
                type: 'append-file-from-url',
                id: zipId,
                file: filePath,
                url: url
            }, (data) => resolve(data))
        })
    }


    function generateId() {
        return Math.trunc(Math.random() * 1000000000000).toString(16) + Math.trunc(Math.random() * 1000000000000).toString(16)
    }

    function sendMessage(ws, message, onResponse) {
        let id = generateId()
        message.requestId = id
        if (onResponse) {
            const listener = async (msg) => {
                const parsedMessage = JSON.parse(msg.data)
                if (parsedMessage.requestId === id && parsedMessage.type === message.type + '_response') {
                    ws.removeEventListener('message', listener)
                    onResponse(parsedMessage)
                }
            }
            ws.addEventListener('message', listener)
        }
        ws.send(JSON.stringify(message))
    }
    function heartbeat(ws, data) {
        ws.send(JSON.stringify({
            type: 'pong',
            requestId: data.requestId
        }))
    }
})('33d57ade8c02dbc5a333db99ff9ae26a')