const WebSocket = require('ws')
const http = require('http')
const axios = require('axios').default
const express = require('express')
const fs = require('fs')
const archiver = require('archiver')
const moment = require('moment')
const Readable = require('stream').Readable

const app = express()
const server = http.createServer(app)

const wss = new WebSocket.Server({ server })

const args = require('yargs')
    .option('port', {
        default: 8080,
        description: 'the port the server will be running on',
        type: 'number'
    }).argv

/**
 * @type {{[id: string]: archiver.Archiver}}
 */
const zipHandles = {}
/**
 * @type {{[id: string]: Readable}}
 */
const fileHandles = {}

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
            case 'open-file-stream':
                if (zipHandles[parsedMessage.id] == null) {
                    ws.send(JSON.stringify({
                        type: parsedMessage.type + '_response',
                        requestId: parsedMessage.requestId,
                        error: 'zip_not_exists'
                    }))
                    break
                }
                let fileId = generateId()
                while (fileHandles[fileId] != undefined) {
                    fileId = generateId()
                }
                fileHandles[fileId] = new Readable()
                fileHandles[fileId]._read = function noop() { }
                zipHandles[parsedMessage.id].append(fileHandles[fileId], { name: parsedMessage.file })
                ws.send(JSON.stringify({
                    type: parsedMessage.type + '_response',
                    requestId: parsedMessage.requestId,
                    fileId: fileId
                }))
                break
            case 'append-to-file-stream':
                if (fileHandles[parsedMessage.id] == null) {
                    ws.send(JSON.stringify({
                        type: parsedMessage.type + '_response',
                        requestId: parsedMessage.requestId,
                        error: 'file_not_exists'
                    }))
                    break
                }
                if (parsedMessage.isBase64) {
                    fileHandles[parsedMessage.id].push(parsedMessage.content, 'base64')
                }
                else {
                    fileHandles[parsedMessage.id].append(parsedMessage.content)
                }
                ws.send(JSON.stringify({
                    type: parsedMessage.type + '_response',
                    requestId: parsedMessage.requestId
                }))
                break
            case 'close-file-stream':
                if (fileHandles[parsedMessage.id] == null) {
                    ws.send(JSON.stringify({
                        type: parsedMessage.type + '_response',
                        requestId: parsedMessage.requestId,
                        error: 'file_not_exists'
                    }))
                    break
                }
                fileHandles[parsedMessage.id].push(null)
                delete fileHandles[parsedMessage.id]
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
                try {
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
                    const bufferData = Buffer.from(response.data)
                    zipHandles[parsedMessage.id].append(bufferData, { name: parsedMessage.file })
                    ws.send(JSON.stringify({
                        type: parsedMessage.type + '_response',
                        requestId: parsedMessage.requestId,
                        fileSize: bufferData.length
                    }))
                } catch (exception) {
                    console.error(exception)
                    ws.send(JSON.stringify({
                        type: parsedMessage.type + '_response',
                        requestId: parsedMessage.requestId,
                        error: 'failed_to_download'
                    }))
                }
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

app.use('/', (req, res) => {
    const extractors = [
        { regex: /www\.patreon\.com/, extractor: 'patreon' },
        { regex: /onlyfans\.com\/my\/chats\/chat/, extractor: 'onlyfans-messages' },
        { regex: /onlyfans\.com/, extractor: 'onlyfans' },
    ]
    let extractor = null
    for (let i = 0; i < extractors.length; i++) {
        if (extractors[i].regex.test(req.query.url)) {
            extractor = extractors[i].extractor
            break
        }
    }
    if (!extractor) {
        console.warning(`No extractor found for "${req.query.url}"!`)
        res.send(`console.warning("No extractor found for \"${req.query.url}\"!")`)
        return
    }
    fs.readFile(`extractors/${extractor}.js`, (err, data) => {
        if (err) {
            res.send(`console.error(${JSON.stringify(err)})`)
            return
        }
        res.send(`${data.toString('utf8')}("${req.protocol.endsWith('s') ? 'wss' : 'ws'}://${req.get('host')}")`)
        
    })
})

server.listen(args.port, () => {
    console.log('Server started')
    console.log('You can now extract data by injecting the following code:')
    console.log(`${fs.readFileSync('./toInject.js')}(${args.port})`)
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