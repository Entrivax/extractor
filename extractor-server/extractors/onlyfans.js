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

        let postsToBackup = window.prompt('Number of posts to backup (leave empty or write 0 for all)', '')
        if (postsToBackup.trim().length > 0) {
            let postsToBackupParsed = +postsToBackup
            if (isNaN(postsToBackupParsed) || postsToBackupParsed < 0) {
                window.alert('Not valid number of posts')
                return
            }
            postsToBackup = postsToBackupParsed
        } else {
            postsToBackup = 0
        }
        console.log("Downloading posts info")
        while (nextUrl != null && (postsToBackup === 0 || (postsToBackup > 0 && data.length < postsToBackup))) {
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

        if (postsToBackup > 0 && data.length > postsToBackup) {
            data = data.slice(0, postsToBackup)
        }

        console.log("Finished downloading posts info")

        console.log("Filter links of files to download")
        let filesUrls = {}
        let userIds = []
        scrapUserMedia(creator)
        data.forEach(d => {
            scrapPostMedia(d)
        })
        function addFile(f) {
            if (f != null) {
                const url = new URL(f)
                const urlNoSearch = encodeURI(`${encodeURIComponent(url.host)}${url.pathname}`)
                if (filesUrls[urlNoSearch] == null) {
                    filesUrls[urlNoSearch] = f
                }
            }
        }
        async function scrapUserMedia(user) {
            if (user == null) {
                return
            }
            addFile(user.avatar)
            if (user.avatarThumbs) {
                Object.keys(user.avatarThumbs).forEach((a) => {
                    if (user.avatarThumbs[a]) {
                        addFile(user.avatarThumbs[a])
                        user.avatarThumbs[a] = cleanUrl(user.avatarThumbs[a])
                    }
                })
            }
            addFile(user.header)
            if (user.headerThumbs) {
                Object.keys(user.headerThumbs).forEach((h) => {
                    if (user.headerThumbs[h]) {
                        addFile(user.headerThumbs[h])
                        user.headerThumbs[h] = cleanUrl(user.headerThumbs[h])
                    }
                })
            }
        }
        async function scrapPostMedia(post) {
            if (post == null) {
                return
            }
            post.media.forEach(m => {
                if (m.files) {
                    Object.keys(m.files).forEach((f) => {
                        if (m.files[f]?.url) {
                            addFile(m.files[f].url)
                            m.files[f].url = cleanUrl(m.files[f].url)
                        }
                    })
                }
                if (m.full) {
                    addFile(m.full)
                    m.full = cleanUrl(m.full)
                }
                if (m.info?.source?.source) {
                    addFile(m.info.source.source)
                    m.info.source.source = cleanUrl(m.info.source.source)
                }
                if (m.preview) {
                    addFile(m.preview)
                    m.preview = cleanUrl(m.preview)
                }
                if (m.source?.source) {
                    addFile(m.source.source)
                    m.source.source = cleanUrl(m.source.source)
                }
                if (m.squarePreview) {
                    addFile(m.squarePreview)
                    m.squarePreview = cleanUrl(m.squarePreview)
                }
                if (m.thumb) {
                    addFile(m.thumb)
                    m.thumb = cleanUrl(m.thumb)
                }
                if (m.videoSources) {
                    Object.keys(m.videoSources).forEach((k) => {
                        if (m.videoSources[k]) {
                            addFile(m.videoSources[k])
                            m.videoSources[k] = cleanUrl(m.videoSources[k])
                        }
                    })
                }
            })

            post.linkedUsers?.forEach(u => {
                if (userIds.indexOf(u.id) === -1) {
                    userIds.push(u.id)
                }
            })
            post.mentionedUsers?.forEach(u => {
                if (userIds.indexOf(u.id) === -1) {
                    userIds.push(u.id)
                }
            })
            post.linkedPosts?.forEach(p => scrapPostMedia(p))
        }

        function cleanUrl(url) {
            if (url == null) {
                return url
            }
            try {
                let urlParsed = new URL(url)
                return `${urlParsed.origin}${urlParsed.pathname}`
            } catch (e) {
                return url
            }
        }

        let users = {}
        if (userIds.length > 0) {
            users = await new Promise((resolve, reject) => {
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
                xhr.open('POST', `https://onlyfans.com/api2/v2/users/list?app-token=${appToken}`)
                xhr.setRequestHeader('Accept', 'application/json, text/plain, */*')
                xhr.setRequestHeader('content-type', 'application/json')
                xhr.send(JSON.stringify({
                    m: userIds
                }))
            })

            const _userIds = Object.keys(users)
            _userIds.forEach(uid => scrapUserMedia(users[uid]))
        }

        let jsonResult = JSON.stringify({
            creator,
            users,
            data
        })

        await appendFile(ws, zipId, 'data.json', jsonResult)
        await appendFile(ws, zipId, 'data.json.js', `window.onlyFansData = ${jsonResult}`)

        console.log("Downloading posts files")
        await downloadFiles(ws, zipId, filesUrls)
    }


    async function downloadFiles(ws, zipId, files) {
        const parallelDownloadsCount = 6
        const filesStack = Object.keys(files)
        const filesCount = filesStack.length
        const runningPromises = []

        for (let i = 0; i < parallelDownloadsCount && filesStack.length > 0; i++) {
            const zipUrl = filesStack.splice(0, 1)[0]
            runningPromises.push(selfRemovePromise(downloadFile(ws, zipId, zipUrl, files[zipUrl])))
        }

        while (filesStack.length > 0) {
            await Promise.race(runningPromises)

            let downloadedFiles = filesCount - filesStack.length
            if (downloadedFiles % 10 === 0) {
                console.log(`Downloaded ${downloadedFiles}/${filesCount} (${Math.round(((100 * downloadedFiles / filesCount) + Number.EPSILON) * 100) / 100}%)`)
            }

            const zipUrl = filesStack.splice(0, 1)[0]
            runningPromises.push(selfRemovePromise(downloadFile(ws, zipId, zipUrl, files[zipUrl])))
        }

        await Promise.all(runningPromises)

        console.log(`Downloading finished ${filesCount}/${filesCount} (100%)`)

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

    async function downloadFile(ws, zipId, zipUrl, url) {
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