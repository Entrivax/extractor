const args = require('yargs')
    .demandCommand(3, 3)
    .argv
const StreamZip = require('node-stream-zip')
const archiver = require('archiver')
const fs = require('fs')
const readline = require('readline')
const chalk = require('chalk')
const _ = require('lodash')
const cliProgress = require('cli-progress')

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const backupPath = args._[0]
const patchPath = args._[1]
const outputPath = args._[2]

async function main() {
    const zipLoadPromises = []
    const backupZip = new StreamZip({
        file: backupPath,
        storeEntries: true
    })
    zipLoadPromises.push(new Promise((resolve, reject) => {
        backupZip.on('ready', () => {
            resolve()
        })
        backupZip.on('error', (err) => {
            reject(err)
        })
    }))
    const patchZip = new StreamZip({
        file: patchPath,
        storeEntries: true
    })
    zipLoadPromises.push(new Promise((resolve, reject) => {
        patchZip.on('ready', () => {
            resolve()
        })
        patchZip.on('error', (err) => {
            reject(err)
        })
    }))

    await Promise.all(zipLoadPromises)

    const backupAsString = await new Promise((resolve, reject) => {
        backupZip.stream('data.json', (err, stream) => {
            if (err) {
                reject(err)
            }
            resolve(streamToString(stream))
        })
    })
    const backup = JSON.parse(backupAsString)
    const patchAsString = await new Promise((resolve, reject) => {
        patchZip.stream('data.json', (err, stream) => {
            if (err) {
                reject(err)
            }
            resolve(streamToString(stream))
        })
    })
    const patch = JSON.parse(patchAsString)

    if (backup.creator.id !== patch.creator.id) {
        console.log("Creators are different, stopping merge")
        backupZip.close()
        patchZip.close()
        return
    }

    const newBackup = {}
    const filesToExtract = []

    // Creator
    {
        newBackup.creator = fromUser(patch.creator)
    }

    // Friends
    {
        newBackup.friends = (patch.friends || []).map(u => fromUser(u))
    }

    // Referenced users
    {
        const backupUsers = backup.users || {}
        const backupUsersIds = Object.keys(backupUsers)
        const patchUsers = patch.users || {}
        const patchUsersIds = Object.keys(patchUsers)
        const unionUsersIds = _.union(patchUsersIds, backupUsersIds)

        const newUsers = {}
        unionUsersIds.forEach(uid => {
            const user = patchUsers[uid] || backupUsers[uid]
            newUsers[uid] = fromUser(user)
        })

        newBackup.users = newUsers
    }

    // Posts (merge)
    {
        const backupPostsDictionnary = indexify(backup.data)
        const backupPostsIds = Object.keys(backupPostsDictionnary)
        const patchPostsDictionnary = indexify(patch.data)
        const patchPostsIds = Object.keys(patchPostsDictionnary)
        const unionPostsIds = _.union(patchPostsIds, backupPostsIds)

        const newPosts = []
        for (let i = 0; i < unionPostsIds.length; i++) {
            const backupPost = backupPostsDictionnary[unionPostsIds[i]]
            const patchPost = patchPostsDictionnary[unionPostsIds[i]]
            let newPost = postFromBackupAndPatch(backupPost, patchPost)

            newPosts.push(newPost)
        }

        newBackup.data = _.sortBy(newPosts, p => -p.postedAtPrecise)
    }

    // Archived posts (merge)
    {
        const backupPostsDictionnary = indexify(backup.archivedPosts || [])
        const backupPostsIds = Object.keys(backupPostsDictionnary)
        const patchPostsDictionnary = indexify(patch.archivedPosts || [])
        const patchPostsIds = Object.keys(patchPostsDictionnary)
        const unionPostsIds = _.union(patchPostsIds, backupPostsIds)

        const newPosts = []
        for (let i = 0; i < unionPostsIds.length; i++) {
            const backupPost = backupPostsDictionnary[unionPostsIds[i]]
            const patchPost = patchPostsDictionnary[unionPostsIds[i]]
            let newPost = postFromBackupAndPatch(backupPost, patchPost)

            newPosts.push(newPost)
        }

        newBackup.archivedPosts = _.sortBy(newPosts, p => -p.postedAtPrecise)
    }

    // Pinned posts (keep only the most recent)
    {
        newBackup.pinnedPosts = (patch.pinnedPosts || [])
            .map(post => postFromBackupAndPatch(null, post))
    }

    function postFromBackupAndPatch(backupPost, patchPost) {
        let newPost = _.cloneDeep(patchPost)
        if (backupPost) {
            if (backupPost.media && backupPost.media.length > 0) {
                if (!newPost.media || newPost.media.length === 0) {
                    newPost.media = _.cloneDeep(backupPost.media)
                } else {
                    const newMediaArray = []
                    const backupMediaDictionnary = indexify(backupPost.media)
                    const patchMediaDictionnary = indexify(patchPost.media)
                    const mediaIdsUnion = _.union(Object.keys(patchMediaDictionnary), Object.keys(backupMediaDictionnary))
                    mediaIdsUnion.forEach(id => {
                        if (patchMediaDictionnary[id]) {
                            newMediaArray.push(patchMediaDictionnary[id])
                        } else {
                            newMediaArray.push(backupMediaDictionnary[id])
                        }
                    })
                    newPost.media = newMediaArray
                }
            }
        }

        newPost.media?.forEach(m => {
            if (m.files) {
                Object.keys(m.files).forEach((f) => {
                    if (m.files[f]?.url) {
                        addFile(filesToExtract, m.files[f].url)
                    }
                })
            }
            if (m.full) {
                addFile(filesToExtract, m.full)
            }
            if (m.info?.source?.source) {
                addFile(filesToExtract, m.info.source.source)
            }
            if (m.preview) {
                addFile(filesToExtract, m.preview)
            }
            if (m.source?.source) {
                addFile(filesToExtract, m.source.source)
            }
            if (m.squarePreview) {
                addFile(filesToExtract, m.squarePreview)
            }
            if (m.thumb) {
                addFile(filesToExtract, m.thumb)
            }
            if (m.videoSources) {
                Object.keys(m.videoSources).forEach((k) => {
                    if (m.videoSources[k]) {
                        addFile(filesToExtract, m.videoSources[k])
                    }
                })
            }
        })

        newPost.linkedPosts?.forEach(p => postFromBackupAndPatch(null, p))

        return newPost
    }

    // Stories and highlights
    {
        newBackup.stories = patchStoriesFromPatches(backup.stories, patch.stories)

        const backupHighlightsDictionnary = indexify(backup.highlights || [])
        const backupHighlightsIds = Object.keys(backupHighlightsDictionnary)
        const patchHighlightsDictionnary = indexify(patch.highlights || [])
        const patchHighlightsIds = Object.keys(patchHighlightsDictionnary)
        const unionHighlightsIds = _.union(patchHighlightsIds, backupHighlightsIds)

        newBackup.highlights = _.sortBy(unionHighlightsIds.map(id => {
            const backupHighlight = backupHighlightsDictionnary[id]
            const patchHighlight = patchHighlightsDictionnary[id]

            const newHighlight = _.cloneDeep(patchHighlight)
            newHighlight.stories = patchStoriesFromPatches(backupHighlight.stories, newHighlight.stories) // not optimized, 'cuz it's cloning two time patchHighlight.stories, but idc for now
            addFile(filesToExtract, newHighlight.cover)

            return newHighlight
        }), highlightsInfo => new Date(highlightsInfo.createdAt).valueOf())
    }

    function patchStoriesFromPatches(backupStories, patchStories) {
        const backupStoriesDictionnary = indexify(backupStories || [])
        const backupStoriesIds = Object.keys(backupStoriesDictionnary)
        const patchStoriesDictionnary = indexify(patchStories || [])
        const patchStoriesIds = Object.keys(patchStoriesDictionnary)
        const unionStoriesIds = _.union(patchStoriesIds, backupStoriesIds)

        const newStories = []
        for (let i = 0; i < unionStoriesIds.length; i++) {
            const newStory = _.cloneDeep(patchStoriesDictionnary[unionStoriesIds[i]] || backupStoriesDictionnary[unionStoriesIds[i]])

            newStory.media?.forEach(m => {
                if (m.files) {
                    let keys = Object.keys(m.files)
                    keys.forEach(k => {
                        addFile(filesToExtract, m.files[k].url)
                        if (m.files[k].sources) {
                            let sources = Object.keys(m.files[k].sources)
                            sources.forEach(source => {
                                addFile(filesToExtract, m.files[k].sources[source])
                            })
                        }
                    })
                }
            })

            newStories.push(newStory)
        }

        return _.sortBy(newStories, story => new Date(story.createdAt).valueOf())
    }

    function fromUser(user) {
        addFile(filesToExtract, user.avatar)
        if (user.avatarThumbs) {
            Object.keys(user.avatarThumbs).forEach((a) => {
                addFile(filesToExtract, user.avatarThumbs[a])
            })
        }
        addFile(filesToExtract, user.header)
        if (user.headerThumbs) {
            Object.keys(user.headerThumbs).forEach((h) => {
                addFile(filesToExtract, user.headerThumbs[h])
            })
        }
        return _.cloneDeep(user)
    }

    const output = fs.createWriteStream(outputPath)
    const archive = archiver('zip')
    archive.pipe(output)

    console.log(`Extracting ${filesToExtract.length} files...`)
    const patchEntries = patchZip.entries()
    const backupEntries = backupZip.entries()
    const progressBar = new cliProgress.SingleBar({
        etaAsynchronousUpdate: true,
        etaBuffer: 40
    })
    progressBar.start(filesToExtract.length, 0)
    for (let i = 0; i < filesToExtract.length; i++) {
        const fileToExtract = filesToExtract[i]
        if (!(await copyFromZip(fileToExtract, patchEntries, patchZip, archive))) {
            await copyFromZip(fileToExtract, backupEntries, backupZip, archive)
            progressBar.updateETA()
        }
        progressBar.update(i + 1)
    }
    progressBar.stop()

    function copyFromZip(fileToExtract, entries, fromZip, archive) {
        return new Promise(resolve => {
            if (entries[fileToExtract]) {
                fromZip.stream(fileToExtract, (err, stream) => {
                    if (!err) {
                        archive.append(stream, { name: fileToExtract })
                        stream.on('finish', () => {
                            resolve(true)
                        })
                    } else {
                        resolve(false)
                    }
                })
            } else {
                resolve(false)
            }
        })
    }

    console.log(`Creating json and js files...`)
    const stringifiedBackup = JSON.stringify(newBackup)
    archive.append(Buffer.from(stringifiedBackup), { name: 'data.json' })
    archive.append(Buffer.from(`window.onlyFansData = ${stringifiedBackup}`), { name: 'data.json.js' })

    console.log(`Finalizing...`)
    await archive.finalize()
    console.log(`Closing...`)
    backupZip.close()
    patchZip.close()
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

function indexify(array) {
    return _.chain(array).groupBy('id').mapValues(m => m[0]).value()
}