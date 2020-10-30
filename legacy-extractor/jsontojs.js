const fs = require('fs')
const fileContent = fs.readFileSync('./data.json', {encoding: 'utf8'})
fs.writeFileSync('./data.json.js', `window.patreonData = ${fileContent}`)