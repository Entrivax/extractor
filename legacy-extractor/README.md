# OLD CODE, DO NOT USE
This is here only for historical purposes. Please do not use, this code is not maintained.
This script was written before the rest of the code that is part of this repository.

---

## How to use
1. Go to a Patreon page (`https://www.patreon.com/testuser/posts`) and copy/paste the code in `extractor.js` inside the dev tools console.
1. After finished downloading, it will ask to save a `patreon.zip` file.
1. Extract the zip file in an empty directory
1. If the file `data.json.js` is not present but `data.json` is, copy the file `jsontojs.js` in the directory and execute
    ```sh
    node jsontojs.js
    ```
1. Copy the file `htmlGenerator.js` in the directory and execute
    ```sh
    node htmlGenerator.js
    ```
    A file name `index.html` should have been generated if everything went correctly.
1. You can now delete the files `htmlGenerator.js` and `jsontojs.js` from the directory and open the resulting `index.html` file in your browser