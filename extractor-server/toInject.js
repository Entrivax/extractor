;(function(port) {
    const scr = document.createElement('script')
    scr.src = `http://localhost:${port}/?url=${encodeURIComponent(location.href)}`
    document.body.appendChild(scr)
    setTimeout(() => {
        document.body.removeChild(scr)
    }, 1000)
})