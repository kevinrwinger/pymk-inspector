'use strict'

import { runScrape } from '../renderer/scripts/scrape'
import { initBackgroundScrape, clearCronJob } from '../renderer/scripts/utils'
import menubar from 'menubar'
import {app, ipcMain, dialog} from 'electron'
import log from 'electron-log'
const fs = require('fs')
const path = require('path')
let cronJob = null
app.log = log
// var app = require('electron')
/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (process.env.NODE_ENV !== 'development') {
  global.__static = require('path').join(__dirname, '/static').replace(/\\/g, '\\\\')
}
let mb
app.log.transports.file.level = process.env.NODE_ENV === 'development' ? 'info' : 'warn'
const winURL = process.env.NODE_ENV === 'development'
  ? `http://localhost:9080`
  : `file://${__dirname}/index.html`

ipcMain.on('settings-updated', (event, arg) => {
  app.log.info(`[main][settings-updated] Re-initializng bg scrape with settings from ${app.getPath('userData')}`)
  clearCronJob(cronJob)
  initBackgroundScrape(app.getPath('userData'),
    (results) => {
      mb.window.webContents.send('bg-scrape', results)
    })
    .then((cron) => {
      cronJob = cron
      app.log.info(`[main][settings-updated] app is ready and cronJob is set ${cronJob.name}`)
    })
})

ipcMain.on('fg-scrape', (event, arg) => {
  let config = {
    type: 'foreground',
    event: event,
    creds: arg,
    dbPath: app.getPath('userData')
  }
  runScrape(config)
})

ipcMain.on('get-db-path', (event, arg) => {
  event.returnValue = app.getPath('userData')
})

ipcMain.on('quit-app', (event, arg) => {
  app.quit()
})

ipcMain.on('export-data', (event, arg) => {
  dialog.showSaveDialog({title: 'Chose a folder to save the data to', defaultPath: 'pymk-inspector-people.csv'}, (filepath) => {
    try {
      const dirname = path.dirname(filepath)
      app.log.info(`[export-data] ${path.join(dirname, 'pymk-inspector')}`)
      fs.writeFile(path.join(dirname, 'pymk-inspector-people.csv'), arg.exportData.pymk, (err) => {
        if (err) throw err
        app.log.info(`[export-data] ${path.join(dirname, 'pymk-inspector')}`)
        fs.writeFile(path.join(dirname, 'pymk-inspector-sessions.csv'), arg.exportData.session, (err) => {
          if (err) throw err
          app.log.info(`[export-data] ${path.join(dirname, 'pymk-inspector')}`)
        })
      })
    } catch (err) {
      app.log.error(`[export-data] ${err}`)
    }
  })
})

function createMenuBar () {
  let mb = menubar({icon: require('path').join(__static, 'inspector-dashboard.png'),
    index: winURL,
    width: 420,
    height: 540,
    preloadWindow: true,
    alwaysOnTop: true
  })

  mb.on('ready', function () {
    initBackgroundScrape(app.getPath('userData'),
      (results) => {
        mb.window.webContents.send('bg-scrape', results)
      })
      .then((cron) => {
        cronJob = cron
        app.log.info(`[main][ready] app is ready and cronJob is set ${cronJob.name}`)
      })
  })
}

createMenuBar()

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mb === null) {
    createMenuBar()
  }
})
