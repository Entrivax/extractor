(async function (creator) {
    var scr = document.createElement('script')
    scr.src= 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.2.2/jszip.min.js'
    document.body.appendChild(scr)
    scr = document.createElement('script')
    scr.src= 'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.4.1/jquery.min.js'

    document.body.appendChild(scr)
    scr = document.createElement('script')
    scr.src= 'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/1.3.8/FileSaver.min.js'

    document.body.appendChild(scr)
    let nextUrl = `https://www.patreon.com/api/posts?include=user%2Cattachments%2Cuser_defined_tags%2Ccampaign%2Cpoll.choices%2Cpoll.current_user_responses.user%2Cpoll.current_user_responses.choice%2Cpoll.current_user_responses.poll%2Caccess_rules.tier.null%2Cimages.null%2Caudio.null&fields[post]=change_visibility_at%2Ccomment_count%2Ccontent%2Ccurrent_user_can_delete%2Ccurrent_user_can_view%2Ccurrent_user_has_liked%2Cembed%2Cimage%2Cis_paid%2Clike_count%2Cmin_cents_pledged_to_view%2Cpost_file%2Cpost_metadata%2Cpublished_at%2Cpatron_count%2Cpatreon_url%2Cpost_type%2Cpledge_url%2Cthumbnail_url%2Cteaser_text%2Ctitle%2Cupgrade_url%2Curl%2Cwas_posted_by_campaign_owner&fields[user]=image_url%2Cfull_name%2Curl&fields[campaign]=currency%2Cshow_audio_post_download_links%2Cavatar_photo_url%2Cearnings_visibility%2Cis_nsfw%2Cis_monthly%2Cname%2Curl&fields[access_rule]=access_rule_type%2Camount_cents&fields[media]=id%2Cimage_urls%2Cdownload_url%2Cmetadata%2Cfile_name&sort=-published_at&filter[campaign_id]=${creator.data.id}&filter[is_draft]=false&filter[contains_exclusive_posts]=true&json-api-use-default-includes=false&json-api-version=1.0`
    let data = []
    let included = []
    while (nextUrl != null) {
        let response = await new Promise((resolve, reject) => {
            let xhr = new XMLHttpRequest()
            xhr.onreadystatechange = () => {
                if (xhr.readyState == 4) {
                    if (xhr.status < 400) {
                        resolve(xhr.responseText)
                    } else {
                        reject()
                    }
                }
            }
            xhr.open('GET', nextUrl)
            xhr.send()
        })

        let responseObj = JSON.parse(response)
        nextUrl = responseObj.links && responseObj.links.next ? responseObj.links.next : null
        if (responseObj.data) {
            data.push(...responseObj.data)
        }
        if (responseObj.included) {
            included.push(...responseObj.included)
        }
    }

    let zip = new JSZip();
    let jsonResult = JSON.stringify({
        creator,
        data,
        included
    })
    zip.file('data.json', jsonResult)
    zip.file('data.json.js', `window.patreonData = ${jsonResult}`)

    if (creator.data.attributes) {
        if (creator.data.attributes.avatar_photo_url) {
            await downloadFile(creator.data.attributes.avatar_photo_url)
        }
        if (creator.data.attributes.cover_photo_url) {
            await downloadFile(creator.data.attributes.cover_photo_url)
        }
        if (creator.data.attributes.image_small_url) {
            await downloadFile(creator.data.attributes.image_small_url)
        }
        if (creator.data.attributes.image_url) {
            await downloadFile(creator.data.attributes.image_url)
        }
    }

    for (let dataObj of data) {
        if (dataObj.attributes) {
            if (dataObj.attributes.image) {
                if (dataObj.attributes.image.large_url) {
                    try {
                        await downloadFile(dataObj.attributes.image.large_url)
                    } catch (err) {
                        console.warn(`Error while trying to fetch resource at url "${dataObj.attributes.image.large_url}" :`, err)
                    }
                }
                if (dataObj.attributes.image.thumb_url) {
                    try {
                        await downloadFile(dataObj.attributes.image.thumb_url)
                    } catch (err) {
                        console.warn(`Error while trying to fetch resource at url "${dataObj.attributes.image.thumb_url}" :`, err)
                    }
                }
                if (dataObj.attributes.image.url) {
                    try {
                        await downloadFile(dataObj.attributes.image.url)
                    } catch (err) {
                        console.warn(`Error while trying to fetch resource at url "${dataObj.attributes.image.url}" :`, err)
                    }
                }
            }
            if (dataObj.attributes.content) {
                try {
                    const parser = new DOMParser();
                    const htmlDoc = parser.parseFromString(dataObj.attributes.content, 'text/html');
                    const imgs = htmlDoc.querySelectorAll('img')
                    for (let i = 0; i < imgs.length; i++) {
                        const el = imgs[i]
                        if (!el.hasAttribute('src')) {
                            return
                        }
                        const link = el.getAttribute('src')
                        try {
                            await downloadFile(link)
                        } catch (err) {
                            console.warn(`Error while trying to fetch resource at url "${link}" :`, err)
                        }
                    }
                } catch (err) {
                    console.warn(`Error while parsing post content :`, err)
                }
            }
        }
    }

    for (let includedObj of included) {
        if (includedObj.type === 'media' && includedObj.attributes) {
            if (includedObj.attributes.download_url) {
                for (let image in includedObj.attributes.image_urls) {
                    try {
                        await downloadFile(includedObj.attributes.image_urls[image])
                    } catch (err) {
                        console.warn(`Error while trying to fetch resource at url "${includedObj.attributes.image_urls[image]}" :`, err)
                    }
                }
            }
            if (includedObj.attributes.image_urls) {
                for (let image in includedObj.attributes.image_urls) {
                    try {
                        await downloadFile(includedObj.attributes.image_urls[image])
                    } catch (err) {
                        console.warn(`Error while trying to fetch resource at url "${includedObj.attributes.image_urls[image]}" :`, err)
                    }
                }
            }
        }
    }

    zip.generateAsync({
        type: 'blob'
    }, function updateCallback(metadata) {
        console.log("progression: " + metadata.percent.toFixed(2) + " %");
        if (metadata.currentFile) {
            console.log("current file = " + metadata.currentFile);
        }
    }).then((content) => {
        saveAs(content, 'patreon.zip')
    })


    async function downloadFile(url) {
        let zipUrl = decodeURIComponent(url.replace(/^https?:\/\//, '').replace(/\?(.*)/, ''))
        if (!zip.file(zipUrl)) {
            
            let response = await new Promise((resolve, reject) => {
                let xhr = new XMLHttpRequest()
                xhr.responseType = "arraybuffer"
                xhr.onreadystatechange = () => {
                    if (xhr.readyState == 4) {
                        if (xhr.status < 400) {
                            resolve(xhr.response)
                        } else {
                            reject()
                        }
                    }
                }
                xhr.open('GET', url)
                xhr.send()
            })
            zip.file(zipUrl, response)
        }
        return zipUrl
    }
})(window.patreon.bootstrap.creator)