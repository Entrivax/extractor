const fs = require('fs')
const data = JSON.parse(fs.readFileSync('./data.json'))

const css = `
    html, body {
        width: 100%;
        margin: 0;
        border: 0;
        padding: 0;
    }
    body {
        text-align: center;
        font-size: 16px;
        font-family: sans-serif;
    }

    .cover {
        background-size: cover;
        height: 25vw;
        min-height: 10rem;
        width: 100%;
        background-repeat: no-repeat;
        background-position: center center;
    }

    .banner {
        display: flex;
        align-items: center;
        padding: 0.5rem 1rem;
        border-top: 1px solid rgb(229, 227, 221);
        border-bottom: 1px solid rgb(229, 227, 221);
    }

    .banner > * {
        margin-right: 1rem
    }

    .banner > .profile-image {
        width: 3rem;
        height: 3rem;
        border-radius: 50%;
        background-size: cover;
        background-clip: padding-box;
        overflow: hidden;
        background-repeat: no-repeat;
        background-position: center center;
    }

    .banner > .name {
        font-weight: 700;
        font-size: 1.3125rem;
    }

    .content {
        margin: auto;
        padding-top: 1rem;
        width: 100%;
        max-width: 528px;
    }

    .post {
        width: 100%;
        border: 1px solid rgb(229, 227, 221);
        border-radius: 4px;
        margin-bottom: 1rem;
        text-align: left;
    }

    .post > .img-link {
        width: 100%;
        display: block;
    }

    .post > .img-link > .post-img {
        width: 100%;
    }

    .post > .published-date {
        padding-top: 1.5rem;
        padding-left: 1.5rem;
        color: rgb(106, 103, 95);
        font-size: 0.875rem;
    }

    .post > .title {
        padding-top: .5rem;
        padding-left: 1.5rem;
        font-weight: 700;
        font-size: 1.3125rem;
    }

    .post > .post-text {
        padding: 1.5rem;
        padding-top: .25rem;
    }

    .post > .additional-images {
        margin-top: 5px;
        width: 100%;
        overflow-x: auto;
        display: flex;
    }

    .post > .additional-images > a {
        width: 120px;
        min-width: 120px;
        height: 120px;
        background-position: 50% 50%;
        background-size: cover;
    }

    .post > .additional-images > a:not(:last-child) {
        margin-right: 5px;
    }
`

let html = `<html>
<head>
<meta charset="UTF-8">
<style>
${css}
</style>
<body>
    <div class="cover" style="background-image: url(${data.creator.data.attributes.cover_photo_url.replace(/^https?:\/\//, './').replace(/\?(.*)/, '')})"></div>
    <div class="banner">
        <div class="profile-image" style="background-image: url(${data.creator.data.attributes.avatar_photo_url.replace(/^https?:\/\//, './').replace(/\?(.*)/, '')})"></div>
        <div class="name">${data.creator.data.attributes.name}</div>
        <div>${data.creator.data.attributes.creation_name}</div>
    </div>
    <div class="content">` +
        data.data.map(d => {
            let date = new Date(d.attributes.published_at)
            return `
            <div class="post">
                ${d.attributes.image ? `<a class="img-link" target="blank" href="${d.attributes.image.large_url.replace(/^https?:\/\//, './').replace(/\?(.*)/, '') ? d.attributes.image.large_url.replace(/^https?:\/\//, './').replace(/\?(.*)/, '') : d.attributes.image.url.replace(/^https?:\/\//, './').replace(/\?(.*)/, '')}"><img class="post-img" src="${d.attributes.image.url.replace(/^https?:\/\//, './').replace(/\?(.*)/, '')}"></a>` : ''}
                ${!(d.attributes.post_metadata.image_order.length > 1) ? 
                    "" :
                    (() => {
                        let images_urls = d.attributes.post_metadata.image_order.slice(1).map(iId => {
                            let imgUrls = data.included.find(i => i.id === iId).attributes.image_urls
                            if (imgUrls == undefined) {
                                console.log(iId)
                            }
                            return imgUrls
                        })
                        return `
                        <div class="additional-images">
                            ${
                                images_urls.map((image_urls) => `
                                    <a target="blank" style="background-image: url(${image_urls.thumbnail.replace(/^https?:\/\//, './').replace(/\?(.*)/, '')})" href="${image_urls.original.replace(/^https?:\/\//, './').replace(/\?(.*)/, '')}"></a>
                                `).join("")
                            }
                        </div>
                        `
                    })()
                }
                <div class="published-date">${date.getMonth() + 1}-${date.getDate()}-${date.getFullYear()} at ${date.getHours()}:${date.getMinutes()}</div>
                <div class="title">${d.attributes.title}</div>
                ${d.attributes.content ? `<div class="post-text">${d.attributes.content}</div>` : ''}
            </div>
            `
        }).reduce((a, b) => a + b) +
`   </div>`

fs.writeFileSync('./index.html', html)