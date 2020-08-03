;(function() {
    const extractors = {
        'www.patreon.com': 'patreon',
        'onlyfans.com': 'onlyfans',
    }
    const extractor = extractors[location.host]
    if (!extractor) {
        console.warning(`No extractor found for "${location.host}"!`)
        return
    }
    const scr = document.createElement('script')
    scr.src = `http://localhost:8080/${extractor}.js`
    document.body.appendChild(scr)
    setTimeout(() => {
        document.body.removeChild(scr)
    }, 1000)
})()