# biutjs-devp2p

[![js-standard-style](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)

This library bundles different components for lower-level peer-to-peer connection and message exchange:

- Distributed Peer Table (NDP) / Node Discovery
- RLP Transport Protocol (biutjs-rlp)
- SEC Wire Protocol (SEC)

## Run/Build

This library has to be compiled with babel to a ``Node 6`` friendly source format.
For triggering a (first) build to create the ``lib/`` directory run:

```
npm run build
```

You can also use babel just-in-time compilation to run a script:

```
node -r babel-register [YOUR_SCRIPT_TO_RUN.js]
```

## Usage/Examples

All components of this library are implemented as Node ``EventEmitter`` objects
and make heavy use of the Node.js network stack.

You can react on events from the network like this:

```
ndp.on('peer:added', (peer) => {
  // Your Codes...
})
```

## Distributed Peer Table / Node Discovery Protocol (NDP)

Maintain/manage a list of peers, see [./src/ndp/](./src/ndp/), also 
includes node discovery ([./src/ndp/server.js](./src/ndp/server.js))

### Usage

Create your peer table:

```
const ndp = new NDP(Buffer.from(PRIVATE_KEY, 'hex'), {
  endpoint: {
    address: '0.0.0.0',
    udpPort: null,
    tcpPort: null
  }
})
```

### API


#### `NDP` (extends `EventEmitter`)
NDP Manages a Kademlia DHT K-bucket for storing peer information 
and a BanList for keeping a list of bad peers. ``server.js`` implements the node discovery (``ping``, ``pong``, ``findNeighbours``).

##### `new NDP(privateKey, options)`
Creates new NDP object
- `privateKey` - Key for message encoding/signing.
- `options.refreshInterval` - Interval in ms for refreshing (calling ``findNeighbours``) the peer list (default: ``60s``).
- `options.createSocket` - A datagram (dgram) ``createSocket`` function, passed to ``Server`` (default: ``dgram.createSocket.bind(null, 'udp4')``).
- `options.timeout` - Timeout in ms for server ``ping``, passed to ``Server`` (default: ``10s``).
- `options.endpoint` - Endpoint information to send with the server ``ping``, passed to ``Server`` (default: ``{ address: '0.0.0.0', udpPort: null, tcpPort: null }``).

#### `ndp.bootstrap(peer)` (``async``)
Uses a peer as new bootstrap peer and calls ``findNeighbouts``.
- `peer` - Peer to be added, format ``{ address: [ADDRESS], udpPort: [UDPPORT], tcpPort: [TCPPORT] }``.

#### `ndp.addPeer(object)` (``async``)
Adds a new peer.
- `object` - Peer to be added, format ``{ address: [ADDRESS], udpPort: [UDPPORT], tcpPort: [TCPPORT] }``.

For other utility functions like ``getPeer``, ``getPeers`` see [./src/ndp/index.js](./src/ndp/index.js).

### Events

Events emitted:

| Event         | Description                              |
| ------------- |:----------------------------------------:|
| peer:added    | Peer added to DHT bucket                 |
| peer:removed  | Peer removed from DHT bucket             |
| peer:new      | New peer added                           |
| listening     | Forwarded from server                    |
| close         | Forwarded from server                    |
| error         | Forwarded from server                    |

## RLP Transport Protocol

Connect to a peer, organize the communication, see [./src/rlp/](./src/rlp/)

### Usage

Create your ``RLP`` object:

```
const rlp = new devp2p.RLP(PRIVATE_KEY, {
  ndp: ndp,
  maxPeers: 25,
  capabilities: [
    devp2p.SEC.sec
  ],
  listenPort: null
})
```

### API

#### `RLP` (extends `EventEmitter`)
Manages the handshake (`ECIES`) and the handling of the peer communication (``Peer``).

##### `new RLPx(privateKey, options)`
Creates new RLPx object
- `privateKey` - Key for message encoding/signing.
- `options.timeout` - Peer `ping` timeout in ms (default: ``10s``).
- `options.maxPeers` - Max number of peer connections (default: ``10``).
- `options.clientId` - Client ID string (default example: ``sec``).
- `options.remoteClientIdFilter` - Optional list of client ID filter strings (e.g. `['sec']`).
- `options.capabilities` - Upper layer protocol capabilities, e.g. `[devp2p.SEC.sec]`.
- `options.listenPort` - The listening port for the server or ``null`` for default.
- `options.ndp` - `NDP` object for the peers to connect to (default: ``null``, no `NDP` peer management).

#### `rlp.connect(peer)` (``async``)
Manually connect to peer without `NDP`.
- `peer` - Peer to connect to, format ``{ id: PEER_ID, address: PEER_ADDRESS, port: PEER_PORT }``.

For other connection/utility functions like ``listen``, ``getPeers`` see [./src/rlp/index.js](./src/rlp/index.js).

### Events

Events emitted:

| Event         | Description                              |
| ------------- |:----------------------------------------:|
| peer:added    | Handshake with peer successful           |
| peer:removed  | Disconnected from peer                   |
| peer:error    | Error connecting to peer                 |
| listening     | Forwarded from server                    |
| close         | Forwarded from server                    |
| error         | Forwarded from server                    |

## SECBlock Wire Protocol (SEC)

Upper layer protocol for exchanging SECBlock network data like block headers or transactions with a node, see [./src/sec/](./src/sec/).

### Usage

Send the initial status message with ``sendStatus()``, then wait for the corresponding `status` message
to arrive to start the communication.

```
sec.once('status', () => {
  // Send an initial message
  sec.sendMessage()
})
```

Wait for follow-up messages to arrive, send your responses. 

```
sec.on('message', async (code, payload) => {
  if (code === devp2p.SEC.MESSAGE_CODES.NEW_BLOCK_HASHES) {
    // Do something with your new block hashes :-)
  }
})
```

See the ``example.js`` example for a more detailed use case.

### API

#### `SEC` (extends `EventEmitter`)
Handles the different message types like `NEW_BLOCK_HASHES` or `GET_NODE_DATA` (see `MESSAGE_CODES`) for
a complete list. Currently protocol version `PV` is supported.

##### `new SEC(privateKey, options)`
Normally not instantiated directly but created as a ``SubProtocol`` in the ``Peer`` object.
- `version` - The protocol version for communicating, e.g. `1`.
- `peer` - `Peer` object to communicate with.
- `send` - Wrapped ``peer.sendMessage()`` function where the communication is routed to.

#### `sec.sendStatus(status)`
Send initial status message.
- `status` - Status message to send, format ``{ networkId: CHAIN_ID, td: TOTAL_DIFFICULTY_BUFFER, bestHash: BEST_HASH_BUFFER, genesisHash: GENESIS_HASH_BUFFER }``.

#### `sec.sendMessage(code, payload)`
Send initial status message.
- `code` - The message code, see `MESSAGE_CODES` for available message types.
- `payload` - Payload as a list, will be rlp-encoded.

### Events

Events emitted:

| Event         | Description                              |
| ------------- |:----------------------------------------:|
| message       | Message received                         |
| status        | Status info received                     |

## Tests

There are unit tests in the ``test/`` directory which can be run with:

```
npm run test
```

## License

MIT
