# OnlyFans merger

Script to apply a backup patch on an Onlyfans backup.
Backup patches are made the same way a backup is done.

## Setup
```sh
# Install node_modules
npm install
```

## How to use
```sh
node ./index.js <path-to-old-backup.zip> <path-to-backup-patch.zip> <path-to-merged-backup.zip>
```

For exemple:
```sh
node ./index.js onlyfans-2020-06-01.zip onlyfans-2020-09-20.zip onlyfans-merged.zip
```