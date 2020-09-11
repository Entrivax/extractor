const args = require('yargs')
    .demandCommand(3, 3)
    .argv
const StreamZip = require('node-stream-zip')
const archiver = require('archiver')
const fs = require('fs')
const readline = require('readline')
const chalk = require('chalk')
const diff = require('deep-diff').diff
const _ = require('lodash')

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const backupPath1 = args._[0]
const backupPath2 = args._[1]
const outputPath = args._[2]

async function main() {
    const zipLoadPromises = []
    const backupZip1 = new StreamZip({
        file: backupPath1,
        storeEntries: true
    })
    zipLoadPromises.push(new Promise((resolve, reject) => {
        backupZip1.on('ready', () => {
            resolve()
        })
        backupZip1.on('error', (err) => {
            reject(err)
        })
    }))
    const backupZip2 = new StreamZip({
        file: backupPath2,
        storeEntries: true
    })
    zipLoadPromises.push(new Promise((resolve, reject) => {
        backupZip2.on('ready', () => {
            resolve()
        })
        backupZip2.on('error', (err) => {
            reject(err)
        })
    }))

    await Promise.all(zipLoadPromises)

    const backup1AsString = await new Promise((resolve, reject) => {
        backupZip1.stream('data.json', (err, stream) => {
            if (err) {
                reject(err)
            }
            resolve(streamToString(stream))
        })
    })
    const backup1 = JSON.parse(backup1AsString)
    const backup2AsString = await new Promise((resolve, reject) => {
        backupZip2.stream('data.json', (err, stream) => {
            if (err) {
                reject(err)
            }
            resolve(streamToString(stream))
        })
    })
    const backup2 = JSON.parse(backup2AsString)

    if (backup1.creator.id !== backup2.creator.id) {
        console.log("Creators are different, stopping merge")
        backupZip1.close()
        backupZip2.close()
        return
    }

    const newBackup = {}
    const backup1FilesToExtract = []
    const backup2FilesToExtract = []

    {
        const creatorDiff = diff(backup1.creator, backup2.creator)
        if (creatorDiff && creatorDiff.length > 0) {
            logDiff(creatorDiff)
            const response = await question('Use left or right creator informations?', ['l', 'r'])
            const selectedBackup = {'l': backup1, 'r': backup2}[response]
            const filesList = {'l': backup1FilesToExtract, 'r': backup2FilesToExtract}[response]
            addFile(filesList, selectedBackup.creator.avatar)
            if (selectedBackup.creator.avatarThumbs) {
                Object.keys(selectedBackup.creator.avatarThumbs).forEach((a) => {
                    addFile(filesList, selectedBackup.creator.avatarThumbs[a])
                })
            }
            addFile(filesList, selectedBackup.creator.header)
            if (selectedBackup.creator.headerThumbs) {
                Object.keys(selectedBackup.creator.headerThumbs).forEach((h) => {
                    addFile(filesList, selectedBackup.creator.headerThumbs[h])
                })
            }
            newBackup.creator = selectedBackup.creator
        } else {
            newBackup.creator = backup2.creator
        }
    }

    {
        const backup1Posts = backup1.data.map(p => p.id.toString())
        const backup2Posts = backup2.data.map(p => p.id.toString())
        const intersectingPosts = _.intersection(backup1Posts, backup2Posts)
        const postsConflicts = {}
        for (let i = 0; i < intersectingPosts.length; i++) {
            const post1 = backup1.data.find(p => p.id.toString() === intersectingPosts[i])
            const post2 = backup2.data.find(p => p.id.toString() === intersectingPosts[i])
            const postDiff = diff(post1, post2)
            if (postDiff && postDiff.length > 0) {
                let add = false
                for (let j = 0; j < postDiff.length; j++) {
                    let intersect = _.intersection(postDiff[j].path, ['source',
                        'squarePreview',
                        'full',
                        'preview',
                        'thumb',
                        'url',
                        'videoSources'])
                    // Check if the diff is an url and discard diffs due to the url params
                    if (intersect.length > 0
                        && (typeof(postDiff[j].lhs) !== typeof(postDiff[j].rhs) || typeof(postDiff[j].lhs) === 'string')) {
                        let url1 = new URL(postDiff[j].lhs)
                        let url2 = new URL(postDiff[j].rhs)
                        if (`${url1.origin}${url1.pathname}` !== `${url2.origin}${url2.pathname}`) {
                            add = true
                        }
                    } else {
                        add = true
                    }
                }
                if (add) {
                    postsConflicts[intersectingPosts[i]] = postDiff
                }
            }
        }

        const newPosts = []
        const postsConflictsIds = Object.keys(postsConflicts)
        if (postsConflictsIds.length > 0) {
            let doForAll = null
            for (let i = 0; i < postsConflictsIds.length; i++) {
                let postToTake = null
                if (doForAll == null) {
                    console.log(`------- Conflict on post of id ${chalk.green(postsConflictsIds[i])} -------`)
                    logDiff(postsConflicts[postsConflictsIds[i]])
                    const response = await question('Use left or right creator informations?', postsConflictsIds.length > 1 ? ['l', 'r', 'lall', 'rall'] : ['l', 'r'])
                    if (response.indexOf('all') !== -1) {
                        doForAll = response.charAt(0)
                    } else {
                        postToTake = response
                    }
                }
                if (doForAll != null) {
                    postToTake = doForAll
                }
                let post = { 'l': backup1, 'r': backup2 }[postToTake].data.find(p => p.id.toString() === postsConflictsIds[i])
                if (post != null) {
                    newPosts.push(post)
                    const filesList = {'l': backup1FilesToExtract, 'r': backup2FilesToExtract}[postToTake]
                    addFilesFromPosts(filesList, [post])
                }
            }
        }

        const postsFromBackup1 = backup1.data.filter(p => postsConflictsIds.indexOf(p.id.toString()) === -1)
        addFilesFromPosts(backup1FilesToExtract, postsFromBackup1)
        const postsIgnoreListForBackup2 = postsConflictsIds.concat(postsFromBackup1.map(p => p.id.toString()))
        const postsFromBackup2 = backup2.data.filter(p => postsIgnoreListForBackup2.indexOf(p.id.toString()) === -1)
        addFilesFromPosts(backup2FilesToExtract, postsFromBackup2)

        newBackup.data = _.orderBy(newPosts.concat(postsFromBackup1).concat(postsFromBackup2), p => new Date(p.postedAt), 'desc')

        function addFilesFromPosts(filesList, posts) {
            posts.forEach(post => {
                post.media.forEach(m => {
                    if (m.files) {
                        Object.keys(m.files).forEach((f) => {
                            const a = m.files[f]
                            addFile(filesList, a != null ? a.url : null)
                        })
                    }
                    addFile(filesList, m.full)
                    addFile(filesList, m.info != null && m.info.source != null ? m.info.source.source : null)
                    addFile(filesList, m.preview)
                    addFile(filesList, m.source != null ? m.source.source : null)
                    addFile(filesList, m.squarePreview)
                    addFile(filesList, m.thumb)
                    if (m.videoSources) {
                        Object.keys(m.videoSources).forEach((k) => {
                            addFile(filesList, m.videoSources[k])
                        })
                    }
                })
            })
        }
    }

    const output = fs.createWriteStream(outputPath)
    const archive = archiver('zip')
    archive.pipe(output)

    const backup1Entries = backupZip1.entries()
    console.log(`Extracting ${backup1FilesToExtract.length} files from backup1...`)
    for (let i = 0; i < backup1FilesToExtract.length; i++) {
        const fileToExtract = backup1FilesToExtract[i]
        await new Promise(resolve => {
            if (backup1Entries[fileToExtract]) {
                backupZip1.stream(fileToExtract, (err, stream) => {
                    if (!err) {
                        archive.append(stream, { name: fileToExtract })
                    }

                    stream.on('finish', () => {
                        resolve()
                    })
                })
            } else {
                resolve()
            }
        })
    }
    console.log(`Extracting ${backup2FilesToExtract.length} files from backup2...`)
    const backup2Entries = backupZip2.entries()
    for (let i = 0; i < backup2FilesToExtract.length; i++) {
        const fileToExtract = backup2FilesToExtract[i]
        await new Promise(resolve => {
            if (backup2Entries[fileToExtract]) {
                backupZip2.stream(fileToExtract, (err, stream) => {
                    if (!err) {
                        archive.append(stream, { name: fileToExtract })
                    }

                    stream.on('finish', () => {
                        resolve()
                    })
                })
            } else {
                resolve()
            }
        })
    }

    console.log(`Creating json and js files...`)
    const stringifiedBackup = JSON.stringify(newBackup)
    archive.append(Buffer.from(stringifiedBackup), { name: 'data.json' })
    archive.append(Buffer.from(`window.onlyFansData = ${stringifiedBackup}`), { name: 'data.json.js' })

    console.log(`Finalizing...`)
    archive.finalize()
    backupZip1.close()
    backupZip2.close()
}

;(async function() {
    try {
        await main()
    } catch (e) {
        console.error(e)
    }
    rl.close()
})()

function streamToString(stream) {
    const chunks = []
    return new Promise((resolve, reject) => {
        stream.on('data', chunk => chunks.push(chunk))
        stream.on('error', reject)
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    })
}

/**
 * 
 * @param {string} questionStr 
 * @param {string[]} availableResponses 
 * @returns {Promise<string>}
 */
async function question(questionStr, availableResponses) {
    if (Array.isArray(availableResponses)) {
        questionStr += ` (${availableResponses.reduce((a, b) => a + '/' + b)})`

        let response = null
        while (availableResponses.indexOf(response) === -1) {
            response = await _question(questionStr + ' ')
        }
        return response
    } else {
        return _question(questionStr + ' ')
    }

    function _question(questionStr) {
        return new Promise((resolve) => {
            rl.question(questionStr, resolve)
        })
    }
}

function logDiff(differences) {
    const kindLog = {
        'E': chalk.yellow('Change'),
        'N': chalk.green('Add'),
        'D': chalk.red('Remove'),
    }
    differences.forEach((difference) => {
        if (difference.kind === 'A') {
            console.log(`[${kindLog[difference.item.kind]}] ${chalk.white(difference.path.reduce(
                (a, b) => a + ' > ' + b
            ))}[${difference.index}]: ${JSON.stringify(difference.item.lhs)} -> ${JSON.stringify(difference.item.rhs)}`)
        } else {
            console.log(`[${kindLog[difference.kind]}] ${chalk.white(difference.path.reduce(
                (a, b) => a + ' > ' + b
            ))}: ${JSON.stringify(difference.lhs)} -> ${JSON.stringify(difference.rhs)}`)
        }
    })
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