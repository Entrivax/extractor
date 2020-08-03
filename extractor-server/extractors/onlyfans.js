;(function(appToken) {
    let ws = new WebSocket('ws://localhost:8080')
    let files = []
    ws.onopen = async () => {
        const zipId = (await openZip(ws, 'onlyfans')).zipId

        await extractFromCurrentOnlyfansPage(ws, zipId)
        await closeZip(ws, zipId)
        ws.close()
    }
    ws.addEventListener('message', async (message) => {
        const parsedMessage = JSON.parse(message.data)
        if (parsedMessage.type === 'ping') {
            heartbeat(ws, parsedMessage)
        }
    })

    async function extractFromCurrentOnlyfansPage(ws, zipId) {
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
        Object.keys(creator.avatarThumbs).forEach((a) => {
            addFile(creator.avatarThumbs[a])
        })
        addFile(creator.header)
        Object.keys(creator.headerThumbs).forEach((h) => {
            addFile(creator.headerThumbs[h])
        })
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
                        addFile(m.videoSources.k)
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
        for (let i = 0; i < files.length; i++) {
            const file = files[i]
            try {
                await downloadFile(ws, zipId, file)
            } catch (err) {
                console.warn(`Error while trying to fetch resource at url "${file}" :`, err)
            }
            if (i > 0 && i !== files.length - 1 && i % 10 === 9) {
                console.log(`Downloading... ${i + 1}/${files.length} (${Math.round(((100*(i + 1) / files.length) + Number.EPSILON) * 100) / 100}%)`)
            }
        }
        console.log(`Downloading finished ${files.length}/${files.length} (100%)`)
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
    
                await appendFile(ws, zipId, zipUrl, _arrayBufferToBase64(response), true)
            }
        }
        return zipUrl

        function _arrayBufferToBase64(buffer) {
            var binary = '';
            var bytes = new Uint8Array(buffer);
            var len = bytes.byteLength;
            for (var i = 0; i < len; i++) {
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