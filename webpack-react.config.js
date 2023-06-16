const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

const appsPath = path.join(__dirname, 'apps');
const chatAppPath = path.join(appsPath, 'chat', 'index.tsx');
const searchAppPath = path.join(appsPath, 'search', 'index.tsx');
/**
 * @type {import('webpack').Configuration}
 */
module.exports = {
  entry: {
    chat: chatAppPath,
    search: searchAppPath
  },
  output: {
    path: path.resolve(__dirname, 'media'),
    filename: '[name].js',
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        default: false,
        vendors: false,
        // Split shared code between the two entry points
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'all'
        }
      }
    }
  },
  mode: 'production',
  plugins: [new MiniCssExtractPlugin()],
  optimization: {
    minimizer: [
      '...',
      new CssMinimizerPlugin()
    ]
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
      {
        test: /\.(png|jpg|gif|svg)$/i,
        use: [
          {
            loader: 'url-loader',
            options: {
              limit: 8192,
            },
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
  },
};
