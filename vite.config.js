import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'

function buildNumberPlugin() {
  return {
    name: 'build-number',
    config(_, { command }) {
      let data
      if (existsSync('./build-number.json')) {
        data = JSON.parse(readFileSync('./build-number.json', 'utf8'))
      } else {
        data = { number: 0 }
        writeFileSync('./build-number.json', JSON.stringify(data))
      }
      if (command === 'build') {
        data.number += 1
        writeFileSync('./build-number.json', JSON.stringify(data))
      }
      return { define: { __BUILD_NUMBER__: data.number } }
    },
  }
}

export default defineConfig({
  plugins: [react(), buildNumberPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        privacy: resolve(__dirname, 'privacy/index.html'),
        terms: resolve(__dirname, 'terms/index.html'),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true,
  },
})
