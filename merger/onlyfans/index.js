const args = require('yargs')
    .demandCommand(3, 3)
    .option('zip', {
        type: 'boolean',
        description: 'specify if the output must be a zip file'
    })
    .argv
const Readable = require('stream').Readable
const chalk = require('chalk')
const _ = require('lodash')
const cliProgress = require('cli-progress')
const backupInterface = require('./lib/backup-file-interface')

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