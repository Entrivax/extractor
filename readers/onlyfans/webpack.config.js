const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const HtmlWebpackInlineSourcePlugin = require('html-webpack-inline-source-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const DuplicatePackageCheckerPlugin = require('duplicate-package-checker-webpack-plugin');
const project = require('./aurelia_project/aurelia.json');
const { AureliaPlugin, ModuleDependenciesPlugin } = require('aurelia-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

// config helpers:
const ensureArray = (config) => config && (Array.isArray(config) ? config : [config]) || [];
const when = (condition, config, negativeConfig) =>
    condition ? ensureArray(config) : ensureArray(negativeConfig);

// primary config:
const outDir = path.resolve(__dirname, project.platform.output);
const srcDir = path.resolve(__dirname, 'src');

// devServer config:
const sampleDataDir = path.resolve(__dirname, 'sampleData');

const cssRules = [
    { loader: 'css-loader', options: { importLoaders: 1 } },
    {
        loader: 'postcss-loader'
    }, 
];

const sassRules = [
    {
        loader: "sass-loader",
        options: {
            sassOptions: {
                includePaths: ['node_modules']
            }
        }
    }
];

module.exports = ({ production } = {}, { extractCss, analyze, tests, hmr, port, host } = {}) => ({
    resolve: {
        extensions: ['.ts', '.js'],
        modules: [srcDir, 'node_modules'],

        alias: {
            // https://github.com/aurelia/dialog/issues/387
            // Uncomment next line if you had trouble to run aurelia-dialog on IE11
            // 'aurelia-dialog': path.resolve(__dirname, 'node_modules/aurelia-dialog/dist/umd/aurelia-dialog.js'),

            // https://github.com/aurelia/binding/issues/702
            // Enforce single aurelia-binding, to avoid v1/v2 duplication due to
            // out-of-date dependencies on 3rd party aurelia plugins
            'aurelia-binding': path.resolve(__dirname, 'node_modules/aurelia-binding')
        }
    },
    entry: {
        app: [
            // Uncomment next line if you need to support IE11
            // 'promise-polyfill/src/polyfill',
            'aurelia-bootstrapper'
        ]
    },
    mode: production ? 'production' : 'development',
    output: {
        path: outDir,
        filename: production ? '[name].[chunkhash].bundle.js' : '[name].[hash].bundle.js',
        sourceMapFilename: production ? '[name].[chunkhash].bundle.map' : '[name].[hash].bundle.map',
        chunkFilename: production ? '[name].[chunkhash].chunk.js' : '[name].[hash].chunk.js'
    },
    optimization: {
        runtimeChunk: true,  // separates the runtime chunk, required for long term cacheability
        // moduleIds is the replacement for HashedModuleIdsPlugin and NamedModulesPlugin deprecated in https://github.com/webpack/webpack/releases/tag/v4.16.0
        // changes module id's to use hashes be based on the relative path of the module, required for long term cacheability
        moduleIds: 'hashed',
    },
    performance: { hints: false },
    devServer: {
        contentBase: [outDir, sampleDataDir],
        // serve index.html for all 404 (required for push-state)
        historyApiFallback: false,
        hot: hmr || project.platform.hmr,
        port: port || project.platform.port,
        host: host
    },
    devtool: production ? 'nosources-source-map' : 'cheap-module-eval-source-map',
    module: {
        rules: [
            // CSS required in JS/TS files should use the style-loader that auto-injects it into the website
            // only when the issuer is a .js/.ts file, so the loaders are not applied inside html templates
            {
                test: /\.css$/i,
                issuer: [{ not: [{ test: /\.html$/i }] }],
                use: extractCss ? [{
                    loader: MiniCssExtractPlugin.loader
                }, ...cssRules
                ] : ['style-loader', ...cssRules]
            },
            {
                test: /\.css$/i,
                issuer: [{ test: /\.html$/i }],
                // CSS required in templates cannot be extracted safely
                // because Aurelia would try to require it again in runtime
                use: cssRules
            },
            {
                test: /\.scss$/,
                use: extractCss ? [{
                    loader: MiniCssExtractPlugin.loader
                }, ...cssRules, ...sassRules
                ] : ['style-loader', ...cssRules, ...sassRules],
                issuer: /\.[tj]s$/i
            },
            {
                test: /\.scss$/,
                use: [...cssRules, ...sassRules],
                issuer: /\.html?$/i
            },
            { test: /\.html$/i, loader: 'html-loader' },
            { test: /\.ts$/, loader: "ts-loader" },
            // embed small images and fonts as Data Urls:
            { test: /\.(png|gif|jpg|svg|cur|ico)$/i, loader: 'url-loader' },
            { test: /\.woff2(\?v=[0-9]\.[0-9]\.[0-9])?$/i, loader: 'url-loader', options: { mimetype: 'application/font-woff2' } },
            { test: /\.woff(\?v=[0-9]\.[0-9]\.[0-9])?$/i, loader: 'url-loader', options: { mimetype: 'application/font-woff' } },
            { test: /\.(ttf|eot|otf)(\?v=[0-9]\.[0-9]\.[0-9])?$/i, loader: 'url-loader' },
            {
                test: /environment\.json$/i, use: [
                    { loader: "app-settings-loader", options: { env: production ? 'production' : 'development' } },
                ]
            },
            ...when(tests, {
                test: /\.[jt]s$/i, loader: 'istanbul-instrumenter-loader',
                include: srcDir, exclude: [/\.(spec|test)\.[jt]s$/i],
                enforce: 'post', options: { esModules: true },
            })
        ]
    },
    plugins: [
        ...when(!tests, new DuplicatePackageCheckerPlugin()),
        new AureliaPlugin(),
        new ModuleDependenciesPlugin({
            'aurelia-testing': ['./compile-spy', './view-spy']
        }),
        new HtmlWebpackPlugin({
            template: 'index.ejs',
            minify: production ? {
                removeComments: true,
                collapseWhitespace: true,
                collapseInlineTagWhitespace: true,
                collapseBooleanAttributes: true,
                removeAttributeQuotes: true,
                minifyCSS: true,
                minifyJS: true,
                removeScriptTypeAttributes: true,
                removeStyleLinkTypeAttributes: true,
                ignoreCustomFragments: [/\${.*?}/g]
            } : undefined,
            inlineSource: '.(js|css)$'
        }),
        ...when(production,
            new HtmlWebpackInlineSourcePlugin(),
        ),
        // ref: https://webpack.js.org/plugins/mini-css-extract-plugin/
        ...when(extractCss, new MiniCssExtractPlugin({ // updated to match the naming conventions for the js files
            filename: production ? 'css/[name].[contenthash].bundle.css' : 'css/[name].[hash].bundle.css',
            chunkFilename: production ? 'css/[name].[contenthash].chunk.css' : 'css/[name].[hash].chunk.css'
        })),
        ...when(analyze, new BundleAnalyzerPlugin()),
        /**
         * Note that the usage of following plugin cleans the webpack output directory before build.
         * In case you want to generate any file in the output path as a part of pre-build step, this plugin will likely
         * remove those before the webpack build. In that case consider disabling the plugin, and instead use something like
         * `del` (https://www.npmjs.com/package/del), or `rimraf` (https://www.npmjs.com/package/rimraf).
         */
        new CleanWebpackPlugin()
    ]
});
