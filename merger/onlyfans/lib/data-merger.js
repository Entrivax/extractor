const _ = require('lodash')
module.exports = {
    merge: function(backup, patch, addFile) {
        const newBackup = {}

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
            let newPost = _.cloneDeep(patchPost) || _.cloneDeep(backupPost)
            if (backupPost) {
                if (backupPost.media && backupPost.media.length > 0) {
                    if (!newPost.media || newPost.media.length === 0) {
                        newPost.media = _.cloneDeep(backupPost.media)
                    } else {
                        const newMediaArray = []
                        const backupMediaDictionnary = indexify(backupPost.media)
                        const patchMediaDictionnary = indexify(patchPost?.media)
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
                            addFile(m.files[f].url)
                        }
                    })
                }
                if (m.full) {
                    addFile(m.full)
                }
                if (m.info?.source?.source) {
                    addFile(m.info.source.source)
                }
                if (m.preview) {
                    addFile(m.preview)
                }
                if (m.source?.source) {
                    addFile(m.source.source)
                }
                if (m.squarePreview) {
                    addFile(m.squarePreview)
                }
                if (m.thumb) {
                    addFile(m.thumb)
                }
                if (m.videoSources) {
                    Object.keys(m.videoSources).forEach((k) => {
                        if (m.videoSources[k]) {
                            addFile(m.videoSources[k])
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

                const newHighlight = _.cloneDeep(patchHighlight || backupHighlight)
                newHighlight.stories = patchStoriesFromPatches(backupHighlight?.stories, newHighlight?.stories) // not optimized, 'cuz it's cloning two time patchHighlight.stories, but idc for now
                addFile(newHighlight.cover)

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
                            addFile(m.files[k].url)
                            if (m.files[k].sources) {
                                let sources = Object.keys(m.files[k].sources)
                                sources.forEach(source => {
                                    addFile(m.files[k].sources[source])
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
            addFile(user.avatar)
            if (user.avatarThumbs) {
                Object.keys(user.avatarThumbs).forEach((a) => {
                    addFile(user.avatarThumbs[a])
                })
            }
            addFile(user.header)
            if (user.headerThumbs) {
                Object.keys(user.headerThumbs).forEach((h) => {
                    addFile(user.headerThumbs[h])
                })
            }
            return _.cloneDeep(user)
        }

        function indexify(array) {
            if (array == null) {
                return {}
            }
            return _.chain(array).groupBy('id').mapValues(m => m[0]).value()
        }

        return newBackup
    }
}