const fsNoPromise = require('fs')
const fs = fsNoPromise.promises
const { join, dirname } = require('path')
const StreamZip = require('node-stream-zip')
const archiver = require('archiver')

exports.openBackup = async function(path) {
    const stat = await fs.lstat(path)
    let backup = null
    if (stat.isFile()) {
        backup = new ZipBackup(path)
    } else if (stat.isDirectory()) {
        backup = new DirectoryBackup(path)
    }
    await backup.init()
    return backup
}

class ZipBackup {
    constructor(path) { this._path = path }
    async init() {
        this._zip = new StreamZip({
            file: this._path,
            storeEntries: true
        })
        await new Promise((resolve, reject) => {
            this._zip.on('ready', () => {
                resolve()
            })
            this._zip.on('error', (err) => {
                reject(err)
            })
        })
    }

    async fileExists(path) {
        return this._zip.entry(path) != null
    }

    /**
     * @param {string} path
     * @returns {Promise<NodeJS.ReadableStream>}
     */
    async openFileStream(path) {
        if (!(await this.fileExists(path))) {
            return null
        }
        return new Promise((resolve, reject) => {
            this._zip.stream(path, (err, stream) => {
                if (err) {
                    reject(err)
                    return
                }
                resolve(stream)
            })
        })
    }

    async close() {
        return new Promise((resolve, reject) => {
            this._zip.close((err) => {
                if (err) {
                    reject(err)
                    return
                }
                resolve()
            })
        })
    }
}

class DirectoryBackup {
    constructor(path) { this._path = path }
    async init() { }

    async fileExists(path) {
        const realPath = join(this._path, path)
        try {
            await fs.access(realPath)
        } catch (e) {
            return false
        }
        return true
    }

    /**
     * @param {string} path
     * @returns {Promise<NodeJS.ReadableStream>}
     */
    async openFileStream(path) {
        if (!(await this.fileExists(path))) {
            return null
        }
        const realPath = join(this._path, path)
        return new Promise((resolve, reject) => {
            const stream = fsNoPromise.createReadStream(realPath)
            stream.on('open', () => {
                resolve(stream)
            })
            stream.on('error', () => {
                reject(err)
            })
        })
    }

    async close() { }
}

exports.createBackup = async function(path, zip) {
    let backup = zip ? new WriteZipBackup(path) : new WriteDirectoryBackup(path)
    await backup.init()
    return backup
}

class WriteZipBackup {
    constructor (path) { this._path = path }

    async init() {
        const output = fsNoPromise.createWriteStream(this._path)
        this._archive = archiver('zip')
        this._archive.pipe(output)
    }

    /**
     * @param {string} path
     * @param {NodeJS.ReadableStream} stream
     */
    async addFile(path, stream) {
        this._archive.append(stream, { name: path })
    }

    async close() {
        await this._archive.finalize()
    }
}

class WriteDirectoryBackup {
    constructor (path) { this._path = path }

    async init() {
        await fs.mkdir(this._path)
    }

    /**
     * @param {string} path
     * @param {NodeJS.ReadableStream} stream
     */
    async addFile(path, stream) {
        const realPath = join(this._path, path)
        await fs.mkdir(dirname(realPath), { recursive: true })
        return new Promise((resolve, reject) => {
            const writeStream = fsNoPromise.createWriteStream(realPath)
            writeStream.on('finish', () => {
                resolve()
            })
            writeStream.on('error', (err) => {
                reject(err)
            })
            stream.pipe(writeStream)
        })
    }

    async close() { }
}