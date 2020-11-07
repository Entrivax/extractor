const args = require('yargs')
    .demandCommand(3, 3)
    .option('zip', {
        type: 'boolean',
        description: 'specify if the output must be a zip file'
    })
    .argv
const Readable = require('stream').Readable
const cliProgress = require('cli-progress')
const backupInterface = require('./lib/backup-file-interface')
const dataMerger = require('./lib/data-merger')

const backupPath = args._[0]
const patchPath = args._[1]
const outputPath = args._[2]

async function main() {
    const isOutputZip = args.zip
    const backupZip = await backupInterface.openBackup(backupPath)
    const patchZip = await backupInterface.openBackup(patchPath)

    const backupAsString = await getBackupData(backupZip)
    const backup = JSON.parse(backupAsString)
    const patchAsString = await getBackupData(patchZip)
    const patch = JSON.parse(patchAsString)

    if (backup.creator.id !== patch.creator.id) {
        console.log("Creators are different, stopping merge")
        backupZip.close()
        patchZip.close()
        return
    }

    const filesToExtract = []
    const newBackup = dataMerger.merge(backup, patch, file => addFile(filesToExtract, file))

    const archive = await backupInterface.createBackup(outputPath, isOutputZip)

    console.log(`Extracting ${filesToExtract.length} files...`)
    const progressBar = new cliProgress.SingleBar({
        etaAsynchronousUpdate: true,
        etaBuffer: 40
    })
    progressBar.start(filesToExtract.length, 0)
    for (let i = 0; i < filesToExtract.length; i++) {
        const fileToExtract = filesToExtract[i]
        if (!(await copyFromZip(fileToExtract, patchZip, archive))) {
            if (!(await copyFromZip(fileToExtract, backupZip, archive))) {
                console.warn(`file ${fileToExtract} not found in both sources`)
            }
            progressBar.updateETA()
        }
        progressBar.update(i + 1)
    }
    progressBar.stop()

    async function copyFromZip(fileToExtract, fromZip, archive) {
        if (await fromZip.fileExists(fileToExtract)) {
            try {
                const stream = await fromZip.openFileStream(fileToExtract)
                await archive.addFile(fileToExtract, stream)
                return true
            } catch (err) {
                console.error(err)
                return false
            }
        }
        return false
    }

    console.log(`Creating json and js files...`)
    const stringifiedBackup = JSON.stringify(newBackup)
    await archive.addFile('data.json', stringToString(stringifiedBackup))
    await archive.addFile('data.json.js', stringToString(`window.onlyFansData = ${stringifiedBackup}`))

    console.log(`Finalizing...`)
    await archive.close()
    console.log(`Closing...`)
    await backupZip.close()
    await patchZip.close()
}

;(async function() {
    try {
        await main()
    } catch (e) {
        console.error(e)
    }
})()

async function getBackupData(backupZip) {
    return streamToString(await backupZip.openFileStream('data.json'))
}

function streamToString(stream) {
    const chunks = []
    return new Promise((resolve, reject) => {
        stream.on('data', chunk => chunks.push(chunk))
        stream.on('error', reject)
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    })
}

function stringToString(str) {
    const readable = new Readable()
    readable._read = () => {}
    readable.push(Buffer.from(str))
    readable.push(null)
    return readable
}

function addFile(list, f) {
    f = cleanLink(f)
    if (f != null && list.indexOf(f) === -1) {
        list.push(f)
    }
}

function cleanLink(link) {
    if (typeof link !== "string") {
        return null
    }
    return link.replace(/^https?:\/\//, '').replace(/\?(.*)/, '')
}