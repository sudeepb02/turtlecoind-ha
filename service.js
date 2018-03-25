'use strict'

const TurtleCoind = require('./')
const util = require('util')

var daemon = new TurtleCoind({
  // Load additional daemon parameters here
})

function log (message) {
  console.log(util.format('%s: %s', (new Date()).toUTCString(), message))
}

daemon.on('start', (args) => {
  log(util.format('TurtleCoind has started... %s', args))
  log('TurtleCoind is attempting to synchronize with the network...')
})

daemon.on('synced', () => {
  log('TurtleCoind is synchronized with the network...')
})

daemon.on('ready', (info) => {
  log(util.format('TurtleCoind is waiting for connections at %s @ %s - %s H/s', info.height, info.difficulty, info.globalHashRate))
})

daemon.on('down', () => {
  log('TurtleCoind is not responding... stopping process...')
  daemon.stop()
})

daemon.on('stopped', () => {
  log('TurtleCoind has closed... restarting process...')
  daemon.start()
})

daemon.on('info', (info) => {
  log(info)  
})

daemon.on('error', (err) => {
  log(err)
})

daemon.start()
