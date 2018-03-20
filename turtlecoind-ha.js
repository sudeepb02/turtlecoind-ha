'use strict'

const pty = require('node-pty')
const util = require('util')
const inherits = require('util').inherits
const EventEmitter = require('events').EventEmitter
const request = require('request-promise')
const daemonResponses = {
  synced: 'SUCCESSFULLY SYNCHRONIZED WITH THE TURTLECOIN NETWORK',
  altsynced: 'SYNCHRONIZED OK',
  started: 'Always exit TurtleCoind and Simplewallet with',
  help: 'Show this help'
}
const blockTargetTime = 30

const TurtleCoind = function (opts) {
  opts = opts || {}
  if (!(this instanceof TurtleCoind)) return new TurtleCoind(opts)
  this.path = opts.path
  this.pollingInterval = opts.pollingInterval || 2000
  this.timeout = opts.timeout || 2000
  this.dataDir = opts.dataDir || false
  this.testnet = opts.testnet || false
  this.enableCors = opts.enableCors || false
  this.enableBlockExplorer = opts.enableBlockExplorer || false
  this.rpcBindIp = opts.rpcBindIp || '127.0.0.1'
  this.rpcBindPort = opts.rpcBindPort || 11898
  this.p2pBindIp = opts.p2pBindIp || false
  this.p2pBindPort = opts.p2pBindPort || false
  this.p2pExternalPort = opts.p2pExternalPort || false
  this.allowLocalIp = opts.allowLocalIp || false
  this.peers = opts.peers || false
  this.priorityNodes = opts.priorityNodes || false
  this.exclusiveNodes = opts.exclusiveNodes || false
  this.seedNode = opts.seedNode || false
  this.hideMyPort = opts.hideMyPort || false
  this.dbThreads = opts.dbThreads || false
  this.dbMaxOpenFiles = opts.dbMaxOpenFiles || false
  this.dbWriteBufferSize = opts.dbWriteBufferSize || false
  this.dbReadCacheSize = opts.dbReadCacheSize || false
  this._rpcQueryIp = (this.rpcBindIp === '0.0.0.0') ? '127.0.0.1' : this.rpcBindIp
}
inherits(TurtleCoind, EventEmitter)

TurtleCoind.prototype.start = function () {
  this.sycned = false

  var args = this._buildargs()
  this.child = pty.spawn(this.path, args, {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: process.env.HOME,
    env: process.env
  })

  this.child.on('error', (error) => {
    this.emit('error', util.format('Error in child process...: %s', error))
  })
  this.child.on('data', (data) => {
    this.emit('data', data.trim())
  })
  this.child.on('close', (exitcode) => {
    this.emit('stopped', exitcode)
  })

  // Attach to our own events so that we know when we can start our checking processes
  this.on('data', this._checkChildStdio)
  this.on('synced', this._checkServices)

  this.emit('start', args.join(' '))
}

TurtleCoind.prototype.stop = function () {
  // If we are currently running our checks, it's a good idea to stop them before we go kill the child process
  if (this.checkDaemon) clearInterval(this.checkDaemon)
  this.synced = false

  // We detach ourselves from our own event emitters here so that we don't accidentally stack on top of ourselves when we start back up
  this.removeListener('synced', this._checkServices)
  this.removeListener('data', this._checkChildStdio)

  // Let's try to exit cleanly and if not, kill the process
  if (this.child) this.write('exit')
  setTimeout(() => {
    if (this.child) this.child.kill()
  }, (this.timeout * 2))
}

TurtleCoind.prototype.write = function (data) {
  this._write(util.format('%s\r', data))
}

TurtleCoind.prototype._checkChildStdio = function (data) {
  if (data.indexOf(daemonResponses.synced) !== -1) {
    this.emit('synced')
  } else if (data.indexOf(daemonResponses.altsynced) !== -1) {
    this.emit('synced')
  } else if (data.indexOf(daemonResponses.started) !== -1) {
    this.emit('started')
  } else if (data.indexOf(daemonResponses.help) !== -1) {
    this.help = true
  }
}

TurtleCoind.prototype._checkServices = function () {
  if (!this.synced) {
    this.synced = true
    this.checkDaemon = setInterval(() => {
      Promise.all([
        this._checkRpc(),
        this._checkDaemon()
      ]).then((results) => {
        var info = results[0][0]
        info.globalHashRate = Math.round(info.difficulty / blockTargetTime)
        if (this.trigger) {
          clearTimeout(this.trigger)
          this.trigger = null
        }
        this.emit('ready', info)
      }).catch((err) => {
        this.emit('error', err)
        if (!this.trigger) {
          this.trigger = setTimeout(() => {
            this.emit('down')
          }, (this.timeout * 2))
        }
      })
    }, this.pollingInterval)
  }
}

TurtleCoind.prototype._checkRpc = function () {
  return new Promise((resolve, reject) => {
    Promise.all([
      this._getInfo(),
      this._getHeight(),
      this._getTransactions()
    ]).then((results) => {
      if (results[0].height === results[1].height && results[0].status === results[1].status && results[1].status === results[2].status) {
        return resolve(results)
      } else {
        return reject(new Error('Daemon is returning inconsistent results'))
      }
    }).catch((err) => {
      return reject(util.format('Daemon is not passing checks...: %s', err))
    })
  })
}

TurtleCoind.prototype._checkDaemon = function () {
  return new Promise((resolve, reject) => {
    this.help = false
    this.write('help')
    setTimeout(() => {
      if (this.help) return resolve(true)
      return reject(new Error('Daemon is unresponsive'))
    }, 1000)
  })
}

TurtleCoind.prototype._write = function (data) {
  this.child.write(data)
}

TurtleCoind.prototype._queryRpc = function (method) {
  return new Promise((resolve, reject) => {
    request({
      method: 'GET',
      uri: util.format('http://%s:%s/%s', this.rpcBindIp, this.rpcBindPort, method),
      timeout: this.timeout
    }).then((data) => {
      return resolve(JSON.parse(data))
    }).catch((err) => {
      return reject(err)
    })
  })
}

TurtleCoind.prototype._getInfo = function () {
  return new Promise((resolve, reject) => {
    this._queryRpc('getinfo').then((data) => {
      return resolve(data)
    }).catch((err) => {
      return reject(util.format('Could not get /getInfo: %s', err))
    })
  })
}

TurtleCoind.prototype._getHeight = function () {
  return new Promise((resolve, reject) => {
    this._queryRpc('getheight').then((data) => {
      return resolve(data)
    }).catch((err) => {
      return reject(util.format('Could not get /getheight: %s', err))
    })
  })
}

TurtleCoind.prototype._getTransactions = function () {
  return new Promise((resolve, reject) => {
    this._queryRpc('gettransactions').then((data) => {
      return resolve(data)
    }).catch((err) => {
      return reject(util.format('Could not get /gettransactions: %s', err))
    })
  })
}

TurtleCoind.prototype._buildargs = function () {
  var args = ''
  if (this.dataDir) args = util.format('%s --data-dir %s', args, this.dataDir)
  if (this.testnet) args = util.format('%s --testnet', args)
  if (this.enableCors) args = util.format('%s --enable-cors %s', args, this.enableCors)
  if (this.enableBlockExplorer) args = util.format('%s --enable_blockexplorer', args)
  if (this.rpcBindIp) args = util.format('%s --rpc-bind-ip %s', args, this.rpcBindIp)
  if (this.rpcBindPort) args = util.format('%s --rpc-bind-port %s', args, this.rpcBindPort)
  if (this.p2pBindIp) args = util.format('%s --p2p-bind-ip %s', args, this.p2pBindIp)
  if (this.p2pBindPort) args = util.format('%s --p2p-bind-port %s', args, this.p2pBindPort)
  if (this.p2pExternalPort) args = util.format('%s --p2p-external-port %s', args, this.p2pExternalPort)
  if (this.allowLocalIp) args = util.format('%s --allow-local-ip', args)
  if (Array.isArray(this.peers)) {
    this.peers.forEach((peer) => {
      args = util.format('%s --add-peer %s', args, peer)
    })
  } else if (this.peers) {
    args = util.format('%s --add-peer %s', args, this.peers)
  }
  if (Array.isArray(this.priorityNodes)) {
    this.priorityNodes.forEach((peer) => {
      args = util.format('%s --add-priority-node %s', args, peer)
    })
  } else if (this.priorityNodes) {
    args = util.format('%s --add-priority-node %s', args, this.priorityNodes)
  }
  if (Array.isArray(this.exclusiveNodes)) {
    this.exclusiveNodes.forEach((peer) => {
      args = util.format('%s --add-exclusive-node %s', args, peer)
    })
  } else if (this.exclusiveNodes) {
    args = util.format('%s --add-exclusive-node %s', args, this.exclusiveNodes)
  }
  if (this.seedNode) args = util.format('%s --seed-node %s', args, this.seednode)
  if (this.hideMyPort) args = util.format('%s --hide-my-port', args)
  if (this.dbThreads) args = util.format('%s --db-threads %s', args, this.dbThreads)
  if (this.dbMaxOpenFiles) args = util.format('%s --db-max-open-files %s', args, this.dbMaxOpenFiles)
  if (this.dbWriteBufferSize) args = util.format('%s --db-write-buffer-size %s', args, this.dbWriteBufferSize)
  if (this.dbReadCacheSize) args = util.format('%s --db-read-cache-size %s', args, this.dbReadCacheSize)
  return args.split(' ')
}

module.exports = TurtleCoind
