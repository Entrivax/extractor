const WebSocket = require('ws')
const http = require('http')
const axios = require('axios').default
const express = require('express')
const fs = require('fs')
const path = require('path')
const moment = require('moment')
const Readable = require('stream').Readable
const backupInterface = require('./lib/backup-file-interface')

const app = express()
const server = http.createServer(app)

const wss = new WebSocket.Server({ server })

const args = require('yargs')
    .option('port', {
        default: 8080,
        description: 'the port the server will be running on',
        type: 'number'
    })
    .option('zip', {
        type: 'boolean',
        description: 'specify if the output must be a zip file'
    })
    .argv

/**
 * @type {{[id: string]: import('./lib/backup-file-interface').WriteBackup}}
 */
const zipHandles = {}
/**
 * @type {{[id: string]: Readable}}
 */
const fileHandles = {}

/**
 * @type {{[id: string]: import('./lib/backup-file-interface').ReadBackup}}
 */
const backupHandles = {}

wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('message', async (message) => {
        const parsedMessage = JSON.parse(message)

        switch (parsedMessage.type) {
            case 'load-file-from-backup':
                if (backupHandles[parsedMessage.id] == null) {
                    ws.send(JSON.stringify({
                        type: parsedMessage.type + '_response',
                        requestId: parsedMessage.requestId,
                        error: 'backup_not_loaded'
                    }))
                    break
                }

                if (await backupHandles[parsedMessage.id].fileExists(parsedMessage.path)) {
                    /** @type {NodeJS.ReadableStream} */
                    const stream = await backupHandles[parsedMessage.id].openFileStream(parsedMessage.path)
                    if (parsedMessage.encoding) {
                        stream.setEncoding(parsedMessage.encoding)
                    }
                    stream.on('readable', () => {
                        let chunk = null
                        while ((chunk = stream.read(100000)) != null) {
                            ws.send(JSON.stringify({
                                type: parsedMessage.type + '_response',
                                requestId: parsedMessage.requestId,
                                data: chunk,
                                end: false
                            }))
                        }
                    })
                    stream.on('end', () => {
                        ws.send(JSON.stringify({
                            type: parsedMessage.type + '_response',
                            requestId: parsedMessage.requestId,
                            end: true
                        }))
                    })
                    break
                }
                ws.send(JSON.stringify({
                    type: parsedMessage.type + '_response',
                    requestId: parsedMessage.requestId,
                    error: 'file_not_found'
                }))
                break
            case 'import-file-from-backup':
                if (backupHandles[parsedMessage.backupId] == null) {
                    ws.send(JSON.stringify({
                        type: parsedMessage.type + '_response',
                        requestId: parsedMessage.requestId,
                        error: 'backup_not_loaded'
                    }))
                }
                if (zipHandles[parsedMessage.zipId] == null) {
                    ws.send(JSON.stringify({
                        type: parsedMessage.type + '_response',
                        requestId: parsedMessage.requestId,
                        error: 'zip_not_loaded'
                    }))
                }
                try {
                    if (await backupHandles[parsedMessage.backupId].fileExists(parsedMessage.path)) {
                        const stream = await backupHandles[parsedMessage.backupId].openFileStream(parsedMessage.path)
                        await zipHandles[parsedMessage.zipId].addFile(parsedMessage.path, stream)
                        ws.send(JSON.stringify({
                            type: parsedMessage.type + '_response',
                            requestId: parsedMessage.requestId,
                            success: true
                        }))
                    } else {
                        ws.send(JSON.stringify({
                            type: parsedMessage.type + '_response',
                            requestId: parsedMessage.requestId,
                            success: false
                        }))
                    }
                } catch (err) {
                    console.error(err)
                    ws.send(JSON.stringify({
                        type: parsedMessage.type + '_response',
                        requestId: parsedMessage.requestId,
                        success: false
                    }))
                }
                break
            case 'unload-backup':
                if (backupHandles[parsedMessage.id] == null) {
                    ws.send(JSON.stringify({
                        type: parsedMessage.type + '_response',
                        requestId: parsedMessage.requestId,
                        error: 'backup_not_loaded'
                    }))
                    break
                }
                try {
                    await backupHandles[parsedMessage.id].close()
                    delete backupHandles[parsedMessage.id]
                } catch (e) {
                    ws.send(JSON.stringify({
                        type: parsedMessage.type + '_response',
                        requestId: parsedMessage.requestId,
                        error: 'failed_to_close_backup'
                    }))
                    break
                }
                ws.send(JSON.stringify({
                    type: parsedMessage.type + '_response',
                    requestId: parsedMessage.requestId
                }))
                break
            case 'load-backup':
                {
                    let id = generateId()
                    while (backupHandles[id] != undefined) {
                        id = generateId()
                    }
                    try {
                        let backup = await backupInterface.openBackup(parsedMessage.path)
                        backupHandles[id] = backup
                    } catch (err) {
                        console.error(err)
                        ws.send(JSON.stringify({
                            type: parsedMessage.type + '_response',
                            requestId: parsedMessage.requestId,
                            error: 'failed_to_open_backup',
                            id: -1
                        }))
                    }
                    ws.send(JSON.stringify({
                        type: parsedMessage.type + '_response',
                        requestId: parsedMessage.requestId,
                        id: id
                    }))
                }
                break
            case 'open-zip':
                let id = generateId()
                while (zipHandles[id] != undefined) {
                    id = generateId()
                }
                const date = moment()
                const zipPath = __dirname + `/${parsedMessage.prefix || 'backup'}_${date.format('YYYY-MM-DD_HH-mm-ss')}_${id}${args.zip ? '.zip' : ''}`

                const archive = await backupInterface.createBackup(zipPath, args.zip)
                zipHandles[id] = archive
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
                    zipHandles[parsedMessage.id].addFile(parsedMessage.file, bufferToStream(Buffer.from(parsedMessage.content, 'base64')))
                }
                else {
                    zipHandles[parsedMessage.id].addFile(parsedMessage.file, bufferToStream(Buffer.from(parsedMessage.content)))
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
                zipHandles[parsedMessage.id].addFile(parsedMessage.file, fileHandles[fileId])
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
                    fileHandles[parsedMessage.id].push(parsedMessage.content)
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
                    zipHandles[parsedMessage.id].addFile(parsedMessage.file, bufferToStream(bufferData))
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
                await zipHandles[parsedMessage.id].close()
                delete zipHandles[parsedMessage.id]
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
        console.warn(`No extractor found for "${req.query.url}"!`)
        res.send(`console.warn("No extractor found for \"${req.query.url}\"!")`)
        return
    }
    fs.readFile(path.join(__dirname, `extractors/${extractor}.js`), (err, data) => {
        if (err) {
            res.send(`console.error(${JSON.stringify(err)})`)
            return
        }
        const dataMergerPath = `${__dirname}/../merger/${extractor}/lib/data-merger.js`
        fs.access(dataMergerPath, fs.constants.R_OK, (err) => {
            if (err) {
                res.send(`${data.toString('utf8')}("${req.protocol.endsWith('s') ? 'wss' : 'ws'}://${req.get('host')}")`)
            } else {
                fs.readFile(dataMergerPath, async (err, dataMerger) => {
                    if (err) {
                        res.status(500).send(null)
                        return
                    }

                    res.set('content-type', 'application/javascript; charset')
                    let dataMergerString = dataMerger.toString('utf8')
                        .replace(/module\.exports/, 'const dataMerger')

                    const toSend = Buffer.from(`(function() {
                        ${
                            dataMergerString.split("require('lodash')").join(`(function() {${(await fs.promises.readFile(path.join(__dirname, 'node_modules/lodash/lodash.js'))).toString('utf8')}; return this._})()`)
                        }
                        ${data.toString('utf8')}("${req.protocol.endsWith('s') ? 'wss' : 'ws'}://${req.get('host')}")
                    })()`)
                    res.send(toSend)
                })
            }
        })
        
    })
})

server.listen(args.port, () => {
    console.log('Server started')
    console.log('You can now extract data by injecting the following code:')
    console.log(`${fs.readFileSync(path.join(__dirname, 'toInject.js'))}(${args.port})`)
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

function bufferToStream(buffer) {
    const readable = new Readable()
    readable._read = () => {}
    readable.push(buffer)
    readable.push(null)
    return readable
}

function generateId() {
    return Math.trunc(Math.random() * 1000000000000).toString(16) + Math.trunc(Math.random() * 1000000000000).toString(16)
}