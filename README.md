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
1. Copy the file `index.html` in the `onlyfans-reader` directory inside the folder used for step 1
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
1. Copy the file `index.html` in the `patreon-reader` directory inside the folder used for step 1
1. Double click on the copied `index.html` file

WARNING: The script was only tested when logged and subcribed to the user.
