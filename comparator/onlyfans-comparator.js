const chalk = require('chalk')
const fs = require('fs')
const yargs = require('yargs')
    .demandCommand(2, 2)
    .argv

main()

async function main() {
    let promises = []
    for (let i = 0; i <= 1; i++) {
        const iCopy = i
        promises.push(new Promise((resolve, reject) => {
            fs.readFile(yargs._[iCopy], { encoding: 'utf8' }, (err, data) => {
                if (err) {
                    reject(err)
                    return
                }
                resolve(data)
            })
        }))
    }
    let filesContent = await Promise.all(promises)
    const oldData = JSON.parse(filesContent[0])
    const newData = JSON.parse(filesContent[1])
    if (oldData.creator.id !== newData.creator.id) {
        console.error(chalk.red('Comparing backup of two different creators. Stopping.'))
        return
    }
    const oldPostIds = oldData.data.map(data => data.id)
    const newPostIds = newData.data.map(data => data.id)
    const addedPostsIds = newPostIds.filter(id => oldPostIds.indexOf(id) === -1)
    const removedPostsIds = oldPostIds.filter(id => newPostIds.indexOf(id) === -1)
    if (addedPostsIds.length === 0 && removedPostsIds.length === 0) {
        console.log('No post added or removed.')
    } else {
        if (addedPostsIds.length > 0) {
            console.log('New posts:')
            const addedPosts = addedPostsIds.map(id => newData.data.find(data => data.id === id))
            for (let i = 0; i < addedPosts.length; i++) {
                const post = addedPosts[i]
                let postText = post.rawText.replace('\n', ' ')
                if (postText.length > 60) {
                    postText = postText.slice(0, 60) + '...'
                }
                console.log(` - [${chalk.green(post.id)}] ${postText}`)
            }
        }
        if (removedPostsIds.length > 0) {
            console.log('Removed posts:')
            const removedPosts = removedPostsIds.map(id => oldData.data.find(data => data.id === id))
            for (let i = 0; i < removedPosts.length; i++) {
                const post = removedPosts[i]
                let postText = post.rawText.replace('\n', ' ')
                if (postText.length > 60) {
                    postText = postText.slice(0, 60) + '...'
                }
                console.log(` - [${chalk.red(post.id)}] ${postText}`)
            }
        }
    }

    const oldFavoritedCount = oldData.creator.favoritedCount
    const newFavoritedCount = newData.creator.favoritedCount
    console.log(`Likes: ${oldFavoritedCount === newFavoritedCount ? newFavoritedCount :
        `${oldFavoritedCount} -> ${chalk[oldFavoritedCount > newFavoritedCount ? 'red' : 'green'](newFavoritedCount)}`}`)
    const oldSubcribersCount = oldData.creator.subscribersCount
    const newSubcribersCount = newData.creator.subscribersCount
    console.log(`Fans: ${oldSubcribersCount === newSubcribersCount ? newSubcribersCount :
        `${oldSubcribersCount} -> ${chalk[oldSubcribersCount == null || oldSubcribersCount > newSubcribersCount ? 'red' : 'green'](newSubcribersCount)}`}`)
}