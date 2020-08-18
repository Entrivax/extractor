;(function(creator) {
    let ws = new WebSocket('ws://localhost:8080')
    let files = []
    ws.onopen = async () => {
        const zipId = (await openZip(ws, 'patreon')).zipId

        await extractFromCurrentPatreonPage(ws, zipId)
        await closeZip(ws, zipId)
        ws.close()
    }
    ws.addEventListener('message', async (message) => {
        const parsedMessage = JSON.parse(message.data)
        if (parsedMessage.type === 'ping') {
            heartbeat(ws, parsedMessage)
        }
    })

    async function extractFromCurrentPatreonPage(ws, zipId) {
        let nextUrl = `https://www.patreon.com/api/posts?include=user%2Cattachments%2Cuser_defined_tags%2Ccampaign%2Cpoll.choices%2Cpoll.current_user_responses.user%2Cpoll.current_user_responses.choice%2Cpoll.current_user_responses.poll%2Caccess_rules.tier.null%2Cimages.null%2Caudio.null&fields[post]=change_visibility_at%2Ccomment_count%2Ccontent%2Ccurrent_user_can_delete%2Ccurrent_user_can_view%2Ccurrent_user_has_liked%2Cembed%2Cimage%2Cis_paid%2Clike_count%2Cmin_cents_pledged_to_view%2Cpost_file%2Cpost_metadata%2Cpublished_at%2Cpatron_count%2Cpatreon_url%2Cpost_type%2Cpledge_url%2Cthumbnail_url%2Cteaser_text%2Ctitle%2Cupgrade_url%2Curl%2Cwas_posted_by_campaign_owner&fields[user]=image_url%2Cfull_name%2Curl&fields[campaign]=currency%2Cshow_audio_post_download_links%2Cavatar_photo_url%2Cearnings_visibility%2Cis_nsfw%2Cis_monthly%2Cname%2Curl&fields[access_rule]=access_rule_type%2Camount_cents&fields[media]=id%2Cimage_urls%2Cdownload_url%2Cmetadata%2Cfile_name&sort=-published_at&filter[campaign_id]=${creator.data.id}&filter[is_draft]=false&filter[contains_exclusive_posts]=true&json-api-use-default-includes=false&json-api-version=1.0`
        let data = []
        let included = []
        
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
                xhr.send()
            })
    
            let responseObj = JSON.parse(response)
            nextUrl = responseObj.links && responseObj.links.next ? responseObj.links.next : null
            if (responseObj.data) {
                data.push(...responseObj.data)
            }
            if (responseObj.included) {
                for (let i = 0; i < responseObj.included.length; i++) {
                    let objId = responseObj.included[i].id
                    if (!included.find(i => i.id === objId)) {
                        included.push(responseObj.included[i])
                    }
                }
            }
        }

        let jsonResult = JSON.stringify({
            creator,
            data,
            included
        })

        await appendFile(ws, zipId, 'data.json', jsonResult)
        await appendFile(ws, zipId, 'data.json.js', `window.patreonData = ${jsonResult}`)
        console.log("Finished downloading posts info")

        console.log("Filter links of files to download")
        let files = []

        if (creator.data.attributes) {
            addFile(creator.data.attributes.avatar_photo_url)
            addFile(creator.data.attributes.cover_photo_url)
            addFile(creator.data.attributes.image_small_url)
            addFile(creator.data.attributes.image_url)
            if (creator.data.attributes.summary) {
                try {
                    const parser = new DOMParser()
                    const htmlDoc = parser.parseFromString(creator.data.attributes.summary, 'text/html')
                    const imgs = htmlDoc.querySelectorAll('img')
                    for (let i = 0; i < imgs.length; i++) {
                        const el = imgs[i]
                        if (!el.hasAttribute('src')) {
                            return
                        }
                        const link = el.getAttribute('src')
                        addFile(link)
                    }
                } catch (err) {
                    console.warn(`Error while parsing post content :`, err)
                }
            }
        }

        for (let includedObj of creator.included) {
            if (includedObj.attributes) {
                addFile(includedObj.attributes.image_url)
                addFile(includedObj.attributes.thumb_url)
            }
        }

        for (let dataObj of data) {
            if (dataObj.attributes) {
                if (dataObj.attributes.image) {
                    addFile(dataObj.attributes.image.large_url)
                    addFile(dataObj.attributes.image.thumb_url)
                    addFile(dataObj.attributes.image.url)
                }
                if (dataObj.attributes.content) {
                    try {
                        const parser = new DOMParser()
                        const htmlDoc = parser.parseFromString(dataObj.attributes.content, 'text/html')
                        const imgs = htmlDoc.querySelectorAll('img')
                        for (let i = 0; i < imgs.length; i++) {
                            const el = imgs[i]
                            if (!el.hasAttribute('src')) {
                                return
                            }
                            const link = el.getAttribute('src')
                            addFile(link)
                        }
                    } catch (err) {
                        console.warn(`Error while parsing post content :`, err)
                    }
                }
            }
        }
    
        for (let includedObj of included) {
            if (includedObj.attributes) {
                if (includedObj.type === 'media') {
                    if (includedObj.attributes.download_url) {
                        addFile(includedObj.attributes.download_url)
                    }
                    if (includedObj.attributes.image_urls) {
                        for (let image in includedObj.attributes.image_urls) {
                            addFile(includedObj.attributes.image_urls[image])
                        }
                    }
                } else if (includedObj.type === 'user') {
                    if (includedObj.attributes.image_url) {
                        addFile(includedObj.attributes.image_url)
                    }
                } else if (includedObj.type === 'attachment') {
                    if (includedObj.attributes.url) {
                        addFile(includedObj.attributes.url)
                    }
                } else if (includedObj.type === 'goal') {
                    if (includedObj.attributes.description) {
                        const images = getImagesFromHtmlString(includedObj.attributes.description)
                        for (let i = 0; i < images.length; i++) {
                            addFile(images[i])
                        }
                    }
                }
            }
        }
        
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

    function getImagesFromHtmlString(strDoc) {
        let images = []
        try {
            const parser = new DOMParser()
            const htmlDoc = parser.parseFromString(strDoc, 'text/html')
            const imgs = htmlDoc.querySelectorAll('img')
            for (let i = 0; i < imgs.length; i++) {
                const el = imgs[i]
                if (!el.hasAttribute('src')) {
                    return
                }
                const link = el.getAttribute('src')
                if (link != null && images.indexOf(link) === -1) {
                    images.push(f)
                }
            }
        } catch (err) {
            console.warn(`Error while parsing post content :`, err)
        }
        return images
    }

    async function downloadFile(ws, zipId, url) {
        let zipUrl = decodeURIComponent(url.replace(/^https?:\/\//, '').replace(/\?(.*)/, ''))
        if (files.indexOf(zipUrl) === -1) {
            if (!/https?\:\/\/.*\.patreonusercontent\.com\//g.test(url) && !/https?\:\/\/.*\.patreon\.com\//g.test(url)) {
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
})(window.patreon.bootstrap.creator)