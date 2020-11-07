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
node ./index.js <path-to-old-backup> <path-to-backup-patch> <path-to-merged-backup>
# Or if you want the output in a zip file:
node ./index.js --zip <path-to-old-backup> <path-to-backup-patch> <path-to-merged-backup.zip>
```
Note that the old backup and the backup patch can both be the zip or the extracted directory of a backup.

For exemple:
```sh
node ./index.js onlyfans-2020-06-01.zip onlyfans-2020-09-20.zip onlyfans-merged
# Or if you want the output in a zip file:
node ./index.js --zip onlyfans-2020-06-01.zip onlyfans-2020-09-20.zip onlyfans-merged.zip
# If the backup is extracted:
node ./index.js onlyfans-2020-06-01 onlyfans-2020-09-20.zip onlyfans-merged
```