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
    if (oldData.creator.data.id !== newData.creator.data.id) {
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
                console.log(` - [${chalk.green(post.id)}] ${post.attributes.title}`)
            }
        }
        if (removedPostsIds.length > 0) {
            console.log('Removed posts:')
            const removedPosts = removedPostsIds.map(id => oldData.data.find(data => data.id === id))
            for (let i = 0; i < removedPosts.length; i++) {
                const post = removedPosts[i]
                console.log(` - [${chalk.red(post.id)}] ${post.attributes.title}`)
            }
        }
    }

    const oldPatronsCount = oldData.creator.data.attributes.patron_count
    const newPatronsCount = newData.creator.data.attributes.patron_count
    console.log(`Patrons count: ${oldPatronsCount === newPatronsCount ? newPatronsCount :
        `${oldPatronsCount} -> ${chalk[oldPatronsCount > newPatronsCount ? 'red' : 'green'](newPatronsCount)}`}`)
}