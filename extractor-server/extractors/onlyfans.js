;(function(websocketUrl) {
    ;(function(appToken) {
        let ws = new WebSocket(websocketUrl)
        let files = []
        let statusReporter = null
        let downloadErrors = []
        let totalDownloaded = 0
        ws.onopen = async () => {
            statusReporter = new StatusReporter(() => {
                statusReporter = null
            })
            const creator = await getCreatorInfo()
            let backupPath = window.prompt('If you want to merge data on a previously made backup, you can specify the file path here:', '')

            let loadedBackupId = null
            if (backupPath?.trim().length > 0) {
                loadedBackupId = (await loadBackup(ws, backupPath)).id
            }
            if (loadedBackupId === -1) {
                window.alert('Could not load backup, abort...')
                return
            }
            const zipId = (await openZip(ws, `onlyfans_${creator.username.replace(/\//, '-')}`)).zipId

            try {
                await extractFromCurrentOnlyfansPage(ws, zipId, creator, loadedBackupId)
            } catch (err) {
                console.error(err)
            }
            await closeZip(ws, zipId)
            if (loadedBackupId) {
                await unloadBackup(ws, loadedBackupId)
            }
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
            statusReporter?.setStatusText('Downloading creator info')
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
                xhr.open('GET', `https://onlyfans.com/api2/v2/users${location.pathname}`)
                xhr.setRequestHeader('Accept', 'application/json')
                xhr.setRequestHeader('app-token', appToken)
                xhr.send()
            })
            console.log("Finished downloading creator info")
            statusReporter?.setStatusText('Finished downloading creator info')
            return creator
        }

        async function extractFromCurrentOnlyfansPage(ws, zipId, creator, loadedBackupId) {
            let nextUrl = `https://onlyfans.com/api2/v2/users/${creator.id}/posts?limit=10&order=publish_date_desc&skip_users=all&skip_users_dups=1&pinned=0&format=infinite`
            let data = []
            let pinnedPosts = []
            let archivedPosts = []

            console.log("Downloading posts info")
            statusReporter?.setStatusText('Downloading posts info')
            while (nextUrl != null) {
                let response = await makeRequest(nextUrl, 'GET', undefined)

                let responseObj = JSON.parse(response.responseText)
                nextUrl = responseObj?.hasMore ? `https://onlyfans.com/api2/v2/users/${creator.id}/posts?limit=10&order=publish_date_desc&skip_users=all&skip_users_dups=1&beforePublishTime=${responseObj.list[responseObj.list.length - 1].postedAtPrecise}&pinned=0&format=infinite` : null
                if (responseObj) {
                    data.push(...responseObj.list)
                }
            }

            console.log("Finished downloading posts info")

            console.log("Downloading archived posts info")
            statusReporter?.setStatusText('Downloading archived posts info')
            nextUrl = `https://onlyfans.com/api2/v2/users/${creator.id}/posts/archived?limit=10&order=publish_date_desc&skip_users=all&skip_users_dups=1&pinned=0&format=infinite`
            while (nextUrl != null) {
                let response = await makeRequest(nextUrl, 'GET', undefined)

                let responseObj = JSON.parse(response.responseText)
                nextUrl = responseObj?.hasMore ? `https://onlyfans.com/api2/v2/users/${creator.id}/posts/archived?limit=10&order=publish_date_desc&skip_users=all&skip_users_dups=1&beforePublishTime=${responseObj.list[responseObj.list.length - 1].postedAtPrecise}&pinned=0&format=infinite` : null
                if (responseObj) {
                    archivedPosts.push(...responseObj.list)
                }
            }
            console.log("Finished downloading archived posts info")

            if (creator.hasPinnedPosts) {
                console.log("Downloading pinned posts info")
                statusReporter?.setStatusText('Downloading pinned posts info')
                let response = await makeRequest(`https://onlyfans.com/api2/v2/users/${creator.id}/posts?&order=publish_date_desc&skip_users=all&skip_users_dups=1&pinned=1`, 'GET', undefined)

                let responseObj = JSON.parse(response.responseText)
                if (responseObj) {
                    pinnedPosts.push(...responseObj)
                }
                console.log("Finished downloading pinned posts info")
            }

            let stories = undefined
            if (creator.hasStories)
            {
                console.log("Downloading stories info")
                statusReporter?.setStatusText('Downloading stories info')
                let response = await makeRequest(`https://onlyfans.com/api2/v2/users/${creator.id}/stories?unf=1`, 'GET', undefined)
                stories = JSON.parse(response.responseText)
                console.log("Finished downloading stories info")
            }

            let highlights = undefined
            {
                console.log("Downloading highlights info")
                statusReporter?.setStatusText('Downloading highlights info')
                let response = await makeRequest(`https://onlyfans.com/api2/v2/users/${creator.id}/stories/highlights?unf=1`, 'GET', undefined)
                let tempHighlights = JSON.parse(response.responseText)
                if (tempHighlights?.length > 0) {
                    highlights = []
                    for (let i = 0; i < tempHighlights.length; i++) {
                        let highlightInfo = JSON.parse((await makeRequest(`https://onlyfans.com/api2/v2/stories/highlights/${tempHighlights[i].id}?unf=1`, 'GET', undefined)).responseText)
                        highlights.push(highlightInfo)
                    }
                }
                console.log("Finished downloading highlights info")
            }

            let friends = []
            if (creator.hasFriends)
            {
                console.log("Downloading friends info")
                statusReporter?.setStatusText('Downloading friends info')
                let downloadMore = true
                let offset = 0
                while (downloadMore) {
                    let response = await makeRequest(`https://onlyfans.com/api2/v2/users/${creator.id}/friends?limit=10&offset=${offset}`, 'GET', undefined)
                    let tempFriends = JSON.parse(response.responseText)
                    friends.push(...tempFriends)
                    if (tempFriends.length < 10) {
                        downloadMore = false
                    } else {
                        offset += 10
                    }
                }
                console.log("Finished downloading friends info")
            }

            console.log("Filter links of files to download")
            statusReporter?.setStatusText('Filter links of files to download')
            let filesUrls = {}
            let userIds = []
            scrapUserMedia(creator)
            if (stories?.length > 0) {
                const invalidStories = []
                stories.forEach(story => {
                    for (let i = 0; i < story.media.length; i++) {
                        let media = story.media[i]
                        if (!media.files?.source?.url) {
                            story.media.splice(i, 1)
                            i--
                        }
                    }
                    if (story.media.length < 1) {
                        invalidStories.push(story)
                    } else {
                        scrapStoryInfo(story)
                    }
                })
                invalidStories.forEach(story => {
                    stories.splice(stories.indexOf(story), 1)
                })
            }
            highlights?.forEach((highlightInfo) => {
                addFile(highlightInfo.cover)
                highlightInfo.cover = cleanUrl(highlightInfo.cover)
                const invalidStories = []
                highlightInfo?.stories.forEach(story => {
                    for (let i = 0; i < story.media.length; i++) {
                        let media = story.media[i]
                        if (!media.files?.source?.url) {
                            story.media.splice(i, 1)
                            i--
                        }
                    }
                    if (story.media.length < 1) {
                        invalidStories.push(story)
                    } else {
                        scrapStoryInfo(story)
                    }
                })
                invalidStories.forEach(story => {
                    highlightInfo?.stories.splice(highlightInfo.stories.indexOf(story), 1)
                })
            })
            friends.forEach(friend => {
                scrapUserMedia(friend)
            })
            data.forEach(d => {
                scrapPostMedia(d)
            })
            archivedPosts.forEach(d => {
                scrapPostMedia(d)
            })
            pinnedPosts.forEach(d => {
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
            function addAndCleanFile(f) {
                addFile(f)
                return cleanUrl(f)
            }
            function scrapUserMedia(user) {
                if (user == null) {
                    return
                }
                addFile(user.avatar)
                if (user.avatarThumbs) {
                    Object.keys(user.avatarThumbs).forEach((a) => {
                        if (user.avatarThumbs[a]) {
                            user.avatarThumbs[a] = addAndCleanFile(user.avatarThumbs[a])
                        }
                    })
                }
                addFile(user.header)
                if (user.headerThumbs) {
                    Object.keys(user.headerThumbs).forEach((h) => {
                        if (user.headerThumbs[h]) {
                            user.headerThumbs[h] = addAndCleanFile(user.headerThumbs[h])
                        }
                    })
                }
            }
            function scrapPostMedia(post) {
                if (post == null) {
                    return
                }
                post.media.forEach(m => {
                    if (m.files) {
                        Object.keys(m.files).forEach((f) => {
                            if (m.files[f]?.url) {
                                m.files[f].url = addAndCleanFile(m.files[f].url)
                            }
                        })
                    }
                    if (m.full) {
                        m.full = addAndCleanFile(m.full)
                    }
                    if (m.info?.source?.source) {
                        m.info.source.source = addAndCleanFile(m.info.source.source)
                    }
                    if (m.preview) {
                        m.preview = addAndCleanFile(m.preview)
                    }
                    if (m.source?.source) {
                        m.source.source = addAndCleanFile(m.source.source)
                    }
                    if (m.squarePreview) {
                        m.squarePreview = addAndCleanFile(m.squarePreview)
                    }
                    if (m.thumb) {
                        m.thumb = addAndCleanFile(m.thumb)
                    }
                    if (m.videoSources) {
                        Object.keys(m.videoSources).forEach((k) => {
                            if (m.videoSources[k]) {
                                m.videoSources[k] = addAndCleanFile(m.videoSources[k])
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

            function scrapStoryInfo(story) {
                story.media?.forEach(m => {
                    if (m.files) {
                        let keys = Object.keys(m.files)
                        keys.forEach(k => {
                            if (m.files[k].url) {
                                m.files[k].url = addAndCleanFile(m.files[k].url)
                            }
                            if (m.files[k].sources) {
                                let sources = Object.keys(m.files[k].sources)
                                sources.forEach(source => {
                                    m.files[k].sources[source] = addAndCleanFile(m.files[k].sources[source])
                                })
                            }
                        })
                    }
                })
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
                    xhr.open('POST', `https://onlyfans.com/api2/v2/users/list`)
                    xhr.setRequestHeader('Accept', 'application/json, text/plain, */*')
                    xhr.setRequestHeader('content-type', 'application/json')
                    xhr.setRequestHeader('app-token', appToken)
                    xhr.send(JSON.stringify({
                        m: userIds
                    }))
                })

                const _userIds = Object.keys(users)
                _userIds.forEach(uid => scrapUserMedia(users[uid]))
            }

            let result = {
                creator,
                users,
                data,
                highlights,
                stories,
                friends,
                pinnedPosts,
                archivedPosts
            }

            if (loadedBackupId != null) {
                let jsonResult = JSON.stringify(result)
                await appendFile(ws, zipId, 'data.json.ori', jsonResult)
                await appendFile(ws, zipId, 'data.json.js.ori', `window.onlyFansData = ${jsonResult}`)
                let filesInBackup = []
                result = dataMerger.merge(JSON.parse(await loadFileFromBackup(ws, loadedBackupId, 'data.json')), result, (file) => {
                    if (file == null) {
                        return
                    }
                    try {
                        const url = new URL(file)
                        const urlNoSearch = encodeURI(`${encodeURIComponent(url.host)}${url.pathname}`)
                        if (filesInBackup.indexOf(urlNoSearch) === -1) {
                            filesInBackup.push(urlNoSearch)
                        }
                    } catch (err) {
                        console.warn(err)
                    }
                })

                let diffFiles = _.difference(filesInBackup, Object.keys(filesUrls))
                console.log(`Fetching referenced files from backup (${diffFiles.length} files)`)
                statusReporter?.setStatusText('Fetching referenced files from backup')
                for (let i = 0; i < diffFiles.length; i++) {
                    await tryImportFileFromBackup(ws, loadedBackupId, zipId, diffFiles[i])
                    statusReporter?.setStatusText(`Fetching referenced files from backup (${i + 1}/${diffFiles.length})`)
                }
            }

            let jsonResult = JSON.stringify(result)
            await appendFile(ws, zipId, 'data.json', jsonResult)
            await appendFile(ws, zipId, 'data.json.js', `window.onlyFansData = ${jsonResult}`)

            console.log("Downloading posts files")
            statusReporter?.setStatusText('Downloading posts files')
            await downloadFiles(ws, zipId, filesUrls, loadedBackupId)
        }

        function StatusReporter(onClose) {
            const container = createElement('div', {
                position: 'fixed',
                top: '16px',
                right: '16px',
                width: '260px',
                backgroundColor: '#05b4e2',
                color: '#fff',
                padding: '16px',
                zIndex: '100',
                borderRadius: '4px'
            })

            const statusTextContainer = createElement('div', { marginBottom: '4px' })

            const closeButton = createElement('span', {
                position: 'absolute',
                top: '0px',
                right: '6px',
                cursor: 'pointer'
            })
            closeButton.innerText = 'x'
            closeButton.addEventListener('click', () => {
                remove()
            })
            container.appendChild(closeButton)
            container.appendChild(statusTextContainer)
            document.body.appendChild(container)

            this.setStatusText = function(text) {
                statusTextContainer.innerText = text
            }

            this.remove = remove
            this.addProgress = (text) => {
                return new ProgressBar(text)
            }

            function remove() {
                if (typeof onClose === 'function') {
                    try {
                        onClose()
                    } catch (e) {
                        console.error(e)
                    }
                }
                document.body.removeChild(container)
            }

            function ProgressBar(text) {
                const progressContainer = createElement('div', { marginBottom: '2px' })
                const textContainer = createElement('div', { overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', whiteSpace: 'nowrap' })
                textContainer.innerText = text
                textContainer.title = text
                progressContainer.appendChild(textContainer)
                const progressBarContainer = createElement('div', {
                    display: 'flex',
                    width: '100%',
                    borderRadius: '2px',
                    height: '4px',
                    overflow: 'hidden'
                })
                const progressBarIndeterminate = createElement('div', {
                    height: '100%',
                    flexGrow: '1',
                    backgroundRepeat: 'repeat',
                    backgroundImage: 'linear-gradient(-45deg,#fff 25%,transparent 25%,transparent 50%,#fff 50%,#fff 75%,transparent 75%,transparent)',
                    backgroundSize: '12px 12px',
                    display: 'none'
                })
                const progressBarFilled = createElement('div', {
                    backgroundColor: '#fff',
                    height: '100%',
                    width: '0%'
                })
                const progressBarFiller = createElement('div', {
                    backgroundColor: 'rgba(255, 255, 255, 0.5)',
                    height: '100%',
                    flexGrow: '1'
                })
                progressBarContainer.appendChild(progressBarIndeterminate)
                progressBarContainer.appendChild(progressBarFilled)
                progressBarContainer.appendChild(progressBarFiller)
                progressContainer.appendChild(progressBarContainer)

                this.setProgress = function(progress) {
                    if (progress === undefined) {
                        progressBarIndeterminate.style.display = 'block'
                        progressBarFilled.style.display = progressBarFiller.style.display = 'none'
                    } else {
                        progressBarIndeterminate.style.display = 'none'
                        progressBarFilled.style.display = progressBarFiller.style.display = 'block'
                        progressBarFilled.style.width = `${progress * 100}%`
                    }
                }

                this.end = function() {
                    container.removeChild(progressContainer)
                }

                container.appendChild(progressContainer)
            }
        }

        function createElement(tagName, style) {
            const el = document.createElement(tagName)
            if (style) {
                const keys = Object.keys(style)
                for (let i = 0; i < keys.length; i++) {
                    el.style[keys[i]] = style[keys[i]]
                }
            }
            return el
        }

        function makeRequest(url, method, body) {
            return new Promise((resolve, reject) => {
                let xhr = new XMLHttpRequest()
                xhr.onreadystatechange = () => {
                    if (xhr.readyState == 4) {
                        if (xhr.status < 400) {
                            resolve(xhr)
                        } else {
                            reject()
                        }
                    }
                }
                xhr.open(method, url)
                xhr.setRequestHeader('Accept', 'application/json')
                xhr.setRequestHeader('app-token', appToken)
                xhr.send(body)
            })
        }

        async function downloadFiles(ws, zipId, files, loadedBackupId) {
            const parallelDownloadsCount = 6
            const filesStack = Object.keys(files)
            const filesCount = filesStack.length
            const runningPromises = []

            statusReporter?.setStatusText(`Downloading... (0/${filesCount} | 0%)`)
            for (let i = 0; i < parallelDownloadsCount && filesStack.length > 0; i++) {
                const zipUrl = filesStack.splice(0, 1)[0]
                runningPromises.push(selfRemovePromise(downloadFile(ws, zipId, zipUrl, files[zipUrl], loadedBackupId)))
            }

            while (filesStack.length > 0) {
                await Promise.race(runningPromises)

                updateStatus()

                const zipUrl = filesStack.splice(0, 1)[0]
                runningPromises.push(selfRemovePromise(downloadFile(ws, zipId, zipUrl, files[zipUrl], loadedBackupId)))
            }

            while (runningPromises.length > 0) {
                await Promise.race(runningPromises)

                updateStatus()
            }

            statusReporter?.setStatusText(`Downloading finished (${filesCount} files) | Total downloaded: ${formatSize(totalDownloaded)}${downloadErrors.length > 0 ? ` | Download errors: ${downloadErrors.length}` : ''}`)

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

            function updateStatus() {
                let downloadedFiles = filesCount - (filesStack.length + runningPromises.length)
                statusReporter?.setStatusText(`Downloading... (${downloadedFiles}/${filesCount} | ${Math.round(((100 * downloadedFiles / filesCount) + Number.EPSILON) * 100) / 100}%) | Total downloaded: ${formatSize(totalDownloaded)}${downloadErrors.length > 0 ? ` | Download errors: ${downloadErrors.length}` : ''}`)
            }
            function formatSize(size) {
                if (size > 1000000000) {
                    return `${Math.round((size / 1000000000 + Number.EPSILON) * 100) / 100} GB`
                }
                if (size > 1000000) {
                    return `${Math.round((size / 1000000 + Number.EPSILON) * 100) / 100} MB`
                }
                if (size > 1000) {
                    return `${Math.round((size / 1000 + Number.EPSILON) * 100) / 100} kB`
                }
                return `${size} B`
            }
        }

        async function downloadFile(ws, zipId, zipUrl, url, backupId) {
            const progressBar = statusReporter?.addProgress(url)
            let excep = null
            try {
                var imported = false
                if (backupId != null) {
                    progressBar?.setProgress(undefined)
                    try {
                        if ((await tryImportFileFromBackup(ws, backupId, zipId, zipUrl)).success) {
                            imported = true
                        }
                    } catch (err) { console.warn(err) }
                }
                if (!imported) {
                    if (url.indexOf('https://public.onlyfans.com') >= 0 || url.indexOf('https://cdn2.onlyfans.com/files/thumbs') >= 0) {
                        progressBar?.setProgress(undefined)
                        const response = await appendFileFromUrl(ws, zipId, zipUrl, url)
                        totalDownloaded += response.fileSize
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
                            xhr.onerror = (ev) => {
                                reject()
                            }
                            xhr.ontimeout = (ev) => {
                                reject()
                            }
                            xhr.onprogress = (ev) => {
                                if (ev.lengthComputable) {
                                    progressBar?.setProgress(ev.loaded / ev.total)
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
                        totalDownloaded += responseLength
                    }
                }
            } catch (e) {
                if (e) {
                    excep = e
                }
            } finally {
                progressBar?.end()
            }
            if (excep) {
                downloadErrors.push(url)
                throw excep
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

        function loadBackup(ws, path) {
            return new Promise((resolve) => {
                sendMessage(ws, {
                    type: 'load-backup',
                    path: path
                }, (data) => resolve(data))
            })
        }

        function unloadBackup(ws, id) {
            return new Promise((resolve) => {
                sendMessage(ws, {
                    type: 'unload-backup',
                    id: id
                }, (data) => resolve(data))
            })
        }

        function tryImportFileFromBackup(ws, backupId, zipId, path) {
            return new Promise((resolve) => {
                sendMessage(ws, {
                    type: 'import-file-from-backup',
                    path: path,
                    zipId: zipId,
                    backupId: backupId
                }, (data) => resolve(data))
            })
        }

        function loadFileFromBackup(ws, backupId, path) {
            return new Promise((resolve) => {
                sendMessageWithStreamResponse(ws, {
                    type: 'load-file-from-backup',
                    path: path,
                    id: backupId,
                    encoding: 'utf8'
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
            return new Promise((resolve, reject) => {
                sendMessage(ws, {
                    type: 'append-file-from-url',
                    id: zipId,
                    file: filePath,
                    url: url
                }, (data) => {
                    if (data.error) {
                        reject(new Error(data.error))
                        return
                    }
                    resolve(data)
                })
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

        function sendMessageWithStreamResponse(ws, message, onResponse) {
            let id = generateId()
            message.requestId = id
            if (onResponse) {
                let data = null
                const listener = async (msg) => {
                    const parsedMessage = JSON.parse(msg.data)
                    if (parsedMessage.requestId === id && parsedMessage.type === message.type + '_response') {
                        if (parsedMessage.end || parsedMessage.error) {
                            ws.removeEventListener('message', listener)
                            onResponse(data)
                        } else {
                            if (data == null) {
                                data = parsedMessage.data
                            } else {
                                data += parsedMessage.data
                            }
                        }
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
})
