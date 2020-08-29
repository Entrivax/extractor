# Extractor

Pack of scripts to extract data from Patreon or OnlyFans.

## Requirements
You'll need to have Node.js installed along with npm.

Tested with Node 12.

## Setup
```sh
# Install node_modules
cd extractor-server
npm install
```

## How to use
First, run the server:
```sh
cd extractor-server
node ./index.js
```

### OnlyFans
To download data for a given user:
1. Open your browser to the OnlyFans page of that user, (e.g. `https://onlyfans.com/testuser` for the user `testuser`)
1. Open the dev tools (Ctrl+Shift+I), and open the console tab
1. Copy the content of the file `extractor-server/toInject.js` in the console and press `Enter`
1. Stay on the page until the script says `Downloading finished x/x (100%)`

Now, a file named `onlyfans_{date}_{random_id}.zip` should exist in the `extractor-server` directory containing the backup.

To read the backup:
1. Extract the backup zip file in an empty folder
1. Copy the file `index.html` from the `readers/onlyfans/build` directory to the folder used for step 1
1. Double click on the copied `index.html` file

WARNING: The script was only tested when logged and subcribed to the user.

### OnlyFans messages
To download data for a given chat:
1. Open your browser to an OnlyFans chat, (e.g. `https://onlyfans.com/my/chats/chat/xxxxxxxx`)
1. Open the dev tools (Ctrl+Shift+I), and open the console tab
1. Copy the content of the file `extractor-server/toInject.js` in the console and press `Enter`
1. Stay on the page until the script says `Downloading finished x/x (100%)`

Now, a file named `onlyfans-messagesg_{date}_{random_id}.zip` should exist in the `extractor-server` directory containing the backup.

To read the backup:
1. Extract the backup zip file in an empty folder
1. Copy the file `index.html` from the `readers/onlyfans-messages/build` directory to the folder used for step 1
1. Double click on the copied `index.html` file

WARNING: The script was only tested when logged and subcribed to the user.

### Patreon
To download data for a given user:
1. Open your browser to the Patreon page of that user, (e.g. `https://www.patreon.com/testuser/posts` for the user `testuser`)
1. Open the dev tools (Ctrl+Shift+I), and open the console tab
1. Copy the content of the file `extractor-server/toInject.js` in the console and press `Enter`
1. Stay on the page until the script says `Downloading finished x/x (100%)`

Now, a file named `patreon_{date}_{random_id}.zip` should exist in the `extractor-server` directory containing the backup.

To read the backup:
1. Extract the backup zip file in an empty folder
1. Copy the file `index.html` from the `readers/patreon/build` directory to the folder used for step 1
1. Double click on the copied `index.html` file

WARNING: The script was only tested when logged and subcribed to the user.

## License

### Bootstrap Icons
```
The MIT License (MIT)

Copyright (c) 2019 The Bootstrap Authors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```