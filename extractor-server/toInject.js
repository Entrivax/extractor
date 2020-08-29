;(function() {
    const extractors = [
        { regex: /www\.patreon\.com/, extractor: 'patreon' },
        { regex: /onlyfans\.com\/my\/chats\/chat/, extractor: 'onlyfans-messages' },
        { regex: /onlyfans\.com/, extractor: 'onlyfans' },
    ]
    let extractor = null
    for (let i = 0; i < extractors.length; i++) {
        if (extractors[i].regex.test(location.href)) {
            extractor = extractors[i].extractor
            break
        }
    }
    if (!extractor) {
        console.warning(`No extractor found for "${location.href}"!`)
        return
    }
    const scr = document.createElement('script')
    scr.src = `http://localhost:8080/${extractor}.js`
    document.body.appendChild(scr)
    setTimeout(() => {
        document.body.removeChild(scr)
    }, 1000)
})()