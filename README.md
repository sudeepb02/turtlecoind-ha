# TurtleCoind High-Availability Daemon Wrapper

This project is designed to wrap the TurtleCoind daemon on a *nix system and monitor it for hangups, locks, or other events that cause the daemon to stop responding to requests

The sample **service.js** includes how to automatically restart the daemon if it hangs, locks, or otherwise stops responding.

## Dependencies

* NodeJS v8.x
* TurtleCoind (https://github.com/turtlecoin/turtlecoin)

## Easy Start

You *must* copy ```TurtleCoind``` into the ```turtlecoind-ha``` folder for the easy start process to occur.

```bash
git clone https://github.com/brandonlehmann/turtlecoind-ha.git
cd turtlecoind-ha
cp <TurtleCoind> .
npm i & node service.js
```

** It is highly recommended that you bootstrap the blockchain before starting this service; however, if you do not want to do that you'll need to wait a while for the sync to occur.**

## Keep it Running

I'm a big fan of PM2 so if you don't have it installed, the setup is quite simple.

```bash
npm install -g pm2

pm2 startup
pm2 install pm2-logrotate

pm2 start service.js --watch --name turtlecoind
pm2 save
```

## Documentation

### Initialization

Practically all TurtleCoind command line arguments are exposed in the construtor method. Simply include them in your list of options to get activate or use them. Default values are defined below.

The only required option is the **path** attribute.

```javascript
var daemon = new TurtleCoind({
  path: './TurtleCoind', // Where can I find TurtleCoind?
  dataDir: '~/.TurtleCoin', // Where do you store your blockchain?
  pollingInterval: 2000, // How often to check the daemon in milliseconds
  timeout: 2000, // How long to wait for RPC responses in milliseconds
  testnet: false, // Use the testnet?
  enableCors: false, // Enable CORS support for the domain in this value
  enableBlockExplorer: false, // Enable the block explorer
  rpcBindIp: '127.0.0.1', // What IP to bind the RPC server to
  rpcBindPort: 11898, // What Port to bind the RPC server to
  p2pBindIp: '0.0.0.0', // What IP to bind the P2P network to
  p2pBindPort: 11897, // What Port to bind the P2P network to
  p2pExternalPort: 0, // What External Port to bind the P2P network to for those behind NAT
  allowLocalIp: false, // Add our own IP to the peer list?
  peers: false, // Manually add the peer(s) to the list. Allows for a string or an Array of strings.
  priorityNodes: false, // Manually add the priority node(s) to the peer list. Allows for a string or an Array of strings.
  exclusiveNodes: false, // Only add these node(s) to the peer list. Allows for a string or an Array of strings.
  seedNode: false, // Connect to this node to get the peer list then quit. Allows for a string.
  hideMyPort: false, // Hide from the rest of the network
  dbThreads: 2, // Number of database background threads
  dbMaxOpenFiles: 100, // Number of allowed open files for the DB
  dbWriteBufferSize: 256, // Size of the DB write buffer in MB
  dbReadCacheSize: 10 // Size of the DB read cache in MB
})
```

### Methods

#### daemon.start()

Starts up the daemon and starts monitoring the process.

```javascript
daemon.start()
```

#### daemon.stop()

Stops the daemon and halts all monitoring processes.

```javascript
daemon.stop()
```

#### daemon.write(text)

Allows you to send a line of text to the daemon console

```javascript
daemon.write('help')
```

### Events

#### Event - *data*

Feeds back the *stdout* of the daemon process. You can use this to monitor the progress of the application or hook and do your own development.

```javascript
daemon.on('data', (data) => {
  // do something
})
```

#### Event - *start*

This event is emitted when the daemon starts. The callback contains the command line arguments supplied to TurtleCoind.

```javascript
daemon.on('start', (args) => {
  // do something
})
```

#### Event - *synced*

This event is emitted when the daemon has synchronized with the TurtleCoin network.

```javascript
daemon.on('synced', () => {
  // do something
})
```

#### Event - *ready*

This event is emitted when the daemon is synchronized with the TurtleCoin network and is passing all the checks we have for it. It returns the equivalent of a */getinfo* call to the RPC server with a few minor additions.

```javascript
daemon.on('ready', (info) => {
  // do something
})
```

Sample info

```javascript
{
  "alt_blocks_count": 6,
  "difficulty": 250306555,
  "grey_peerlist_size": 3611,
  "height": 268368,
  "incoming_connections_count": 32,
  "last_known_block_index": 268366,
  "outgoing_connections_count": 8,
  "status": "OK",
  "tx_count": 262381,
  "tx_pool_size": 0,
  "white_peerlist_size": 214,
  "cached": false,
  "globalHashRate": 7123123
}
```

#### Event - *down*

This event is emitted when the daemon is not responding to RPC requests or local console checks. We believe at that point that the daemon is hung.

```javascript
daemon.on('down', () => {
  // do something
})
```

#### Event - *stopped*

This event is emitted when the daemon is stopped.

```javascript
daemon.on('stopped', () => {
  // do something
})
```

#### Event - *info*

This event is emitted when the daemon or our service has something to tell you but its not that important.

```javascript
daemon.on('info', (info) => {
  // do something
})


#### Event - *error*

This event is emitted when the daemon or our service encounters an error.

```javascript
daemon.on('error', (err) => {
  // do something
})

