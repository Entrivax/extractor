# Patreon reader

## Getting Started
1. Open the repository in its devcontainer.
2. Open a terminal in the devcontainer and install dependencies with `cd /workspaces/extractor/readers/patreon && npm install`
3. Run the development server with `npm run dev`, you should be able to access it at http://localhost:5174/#/?base=/data

-   `npm run dev` - Starts a dev server at http://localhost:5173/ but use `http://localhost:5174/#/?base=/data` for testing with data.

-   `npm run build` - Builds for production, emitting to `dist/`

To use data extracted with the extractor-server, copy the files in a backup `patreon_{date}_{random_id}` directory to the `.devcontainer/data/` folder. Then open the reader at `http://localhost:5174/#/?base=/data`.