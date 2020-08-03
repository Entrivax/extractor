const WebSocket = require('ws')
const http = require('http')
const axios = require('axios').default
const express = require('express')
const fs = require('fs')
const archiver = require('archiver')
const moment = require('moment')

const app = express()
const server = http.createServer(app)

const wss = new WebSocket.Server({ server })

/**
 * @type {{[id: string]: archiver.Archiver}}
 */
const zipHandles = {}

wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('message', async (message) => {
        const parsedMessage = JSON.parse(message)

        switch (parsedMessage.type) {
            case 'open-zip':
                let id = generateId()
                while (zipHandles[id] != undefined) {
                    id = generateId()
                }
                const date = moment()
                const zipPath = __dirname + `/${parsedMessage.prefix || 'zip'}_${date.format('YYYY-MM-DD_HH-mm-ss')}_${id}.zip`
                const output = fs.createWriteStream(zipPath)

                const archive = archiver('zip')
                output.on('close', () => {
                    delete zipHandles[id]
                })
                zipHandles[id] = archive
                archive.pipe(output)
                console.log(`Opened zip file ${zipPath}`)
                ws.send(JSON.stringify({
                    type: parsedMessage.type + '_response',
                    requestId: parsedMessage.requestId,
                    zipId: id
                }))
                break
            case 'append-file':
                if (zipHandles[parsedMessage.id] == null) {
                    ws.send(JSON.stringify({
                        type: parsedMessage.type + '_response',
                        requestId: parsedMessage.requestId,
                        error: 'zip_not_exists'
                    }))
                    break
                }
                if (parsedMessage.isBase64) {
                    zipHandles[parsedMessage.id].append(Buffer.from(parsedMessage.content, 'base64'), { name: parsedMessage.file })
                }
                else {
                    zipHandles[parsedMessage.id].append(Buffer.from(parsedMessage.content), { name: parsedMessage.file })
                }
                ws.send(JSON.stringify({
                    type: parsedMessage.type + '_response',
                    requestId: parsedMessage.requestId
                }))
                break
            case 'append-file-from-url':
                if (zipHandles[parsedMessage.id] == null) {
                    ws.send(JSON.stringify({
                        type: parsedMessage.type + '_response',
                        requestId: parsedMessage.requestId,
                        error: 'zip_not_exists'
                    }))
                    break
                }
                const response = await axios.get(parsedMessage.url, {
                    responseType: 'arraybuffer',
                })
                if (response.status >= 400) {
                    ws.send(JSON.stringify({
                        type: parsedMessage.type + '_response',
                        requestId: parsedMessage.requestId,
                        error: 'failed_to_download'
                    }))
                    break
                }
                zipHandles[parsedMessage.id].append(Buffer.from(response.data), { name: parsedMessage.file })
                ws.send(JSON.stringify({
                    type: parsedMessage.type + '_response',
                    requestId: parsedMessage.requestId
                }))
                break
            case 'end':
                if (zipHandles[parsedMessage.id] == null) {
                    ws.send(JSON.stringify({
                        type: parsedMessage.type + '_response',
                        requestId: parsedMessage.requestId,
                        error: 'zip_not_exists'
                    }))
                    break
                }
                zipHandles[parsedMessage.id].finalize()
                console.log(`Closed zip handle ${parsedMessage.id}`)
                ws.send(JSON.stringify({
                    type: parsedMessage.type + '_response',
                    requestId: parsedMessage.requestId
                }))
                break
        }
    });
});

app.use('/', express.static('./extractors'))

server.listen(8080, () => {
    console.log('Server started')
})

setInterval(function ping() {
    wss.clients.forEach(function each(ws) {
        let id = generateId()
        ws.send(JSON.stringify({
            type: 'ping',
            requestId: id
        }))
    })
}, 25000)

function generateId() {
    return Math.trunc(Math.random() * 1000000000000).toString(16) + Math.trunc(Math.random() * 1000000000000).toString(16)
}