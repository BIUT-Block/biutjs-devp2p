const chalk = require('chalk')
const LRUCache = require('lru-cache')
const ms = require('ms')
const crypto = require('crypto')
const assert = require('assert')
const devp2p = require('../lib')
const SECRlpEncode = require('@biut-block/biutjs-rlp')
const secjsRlp = new SECRlpEncode()

const port = '13331'
const PRIVATE_KEY = crypto.randomBytes(32)

const nodes = [{
  'ip': '18.185.61.169',
  'port': '13331'
}]

// -------------------------  NODE DISCOVERY PROTOCOL  -------------------------
const ndp = new devp2p.NDP(PRIVATE_KEY, {
  refreshInterval: 30000,
  endpoint: {
    address: '0.0.0.0',
    udpPort: port,
    tcpPort: port
  }
})

// --------------------------  RLP TRANSPORT PROTOCL  --------------------------
const CHAIN_ID = 1
const REMOTE_CLIENTID_FILTER = []
// const REMOTE_CLIENTID_FILTER = ['go1.5', 'go1.6', 'go1.7', 'quorum', 'pirl', 'ubiq', 'gmc', 'gwhale', 'prichain']
const CHECK_BLOCK_TITLE = 'Yuan Li' // Only for debugging/console output
const CHECK_BLOCK_NR = 1
// const CHECK_BLOCK_NR = 4370000
const CHECK_BLOCK = 'b1fcff633029ee18ab6482b58ff8b6e95dd7c82a954c852157152a7a6d32785e'
const CHECK_BLOCK_HEADER = secjsRlp.decode(Buffer.from('f9020aa0a0890da724dd95c90a72614c3a906e402134d3859865f715f5dfb398ac00f955a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347942a65aca4d5fc5b5c859090a6c34d164135398226a074cccff74c5490fbffc0e6883ea15c0e1139e2652e671f31f25f2a36970d2f87a00e750bf284c2b3ed1785b178b6f49ff3690a3a91779d400de3b9a3333f699a80a0c68e3e82035e027ade5d966c36a1d49abaeec04b83d64976621c355e58724b8bb90100040019000040000000010000000000021000004020100688001a05000020816800000010a0000100201400000000080100020000000400080000800004c0200000201040000000018110400c000000200001000000280000000100000010010080000120010000050041004000018000204002200804000081000011800022002020020140000000020005080001800000000008102008140008600000000100000500000010080082002000102080000002040120008820400020100004a40801000002a0040c000010000114000000800000050008300020100000000008010000000100120000000040000000808448200000080a00000624013000000080870552416761fabf83475b02836652b383661a72845a25c530894477617266506f6f6ca0dc425fdb323c469c91efac1d2672dfdd3ebfde8fa25d68c1b3261582503c433788c35ca7100349f430', 'hex'))

const rlp = new devp2p.RLPx(PRIVATE_KEY, {
  ndp: ndp,
  maxPeers: 25,
  capabilities: [
    devp2p.SEC.sec
  ],
  clientId: 'sec',
  remoteClientIdFilter: REMOTE_CLIENTID_FILTER,
  listenPort: null
})

// -------------------------------------  NODE DISCOVERY PROTOCOL  ------------------------------------

console.log(chalk.blue(`Local Peer PrivateKey: ${PRIVATE_KEY.toString('base64')}`))

ndp.on('listening', () => console.log(chalk.green(`NDP | NDP Server Listening at port: ${port}`)))

ndp.on('close', () => console.log(chalk.green('NDP | NDP Server closed')))

ndp.on('error', err => console.error(chalk.red(`NDP | NDP error: ${err.stack || err}`)))

ndp.on('peer:added', peer => {
  const info = `(${peer.id.toString('hex')}, ${peer.address}:${peer.udpPort}:${peer.tcpPort})`
  console.log(chalk.green(`NDP | peer:added Event | New peer: ${info} (total: ${ndp.getPeers().length})`))
})

ndp.on('peer:removed', peer => {
  console.log(chalk.yellow(`NDP | peer:removed Event | Remove peer: ${peer.id.toString('hex')} (total: ${ndp.getPeers().length})`))
})

// check peer:new event
ndp.on('peer:new', peer => {
  const info = `(${peer.id.toString('hex')}, ${peer.address}:${peer.udpPort}:${peer.tcpPort})`
  console.log(chalk.green(`NDP | peer:new Event | New peer: ${info} (total: ${ndp.getPeers().length})`))
})

// accept incoming connections
ndp.bind(port, '0.0.0.0')

// -------------------------------------  RLP TRANSPORT PROTOCL  ------------------------------------
rlp.on('peer:added', (peer) => {
  const addr = getPeerAddr(peer)
  const sec = peer.getProtocols()[0]
  const requests = {
    headers: [],
    bodies: [],
    msgTypes: {}
  }

  const clientId = peer.getHelloMessage().clientId
  console.log(chalk.cyan(`RLP | peer:added Event | Add peer: ${addr} ${clientId} (sec${sec.getVersion()}) (total: ${rlp.getPeers().length})`))

  sec.sendStatus({
    networkId: CHAIN_ID,
    td: devp2p._util.int2buffer(17179869184), // total difficulty in genesis block
    bestHash: Buffer.from('d4e56740f876aef8c010b86a40d5f56745a118d0906a34e69aec8c0db1cb8fa3', 'hex'),
    genesisHash: Buffer.from('d4e56740f876aef8c010b86a40d5f56745a118d0906a34e69aec8c0db1cb8fa3', 'hex')
  })

  // check CHECK_BLOCK
  // let forkDrop = null
  let forkVerified = false
  sec.once('status', () => {
    console.log(chalk.red('Doing nothing hahahah.....'))
    // sec.sendMessage(devp2p.SEC.MESSAGE_CODES.GET_BLOCK_HEADERS, [CHECK_BLOCK_NR, 1, 0, 0])
    // forkDrop = setTimeout(() => {
    //   peer.disconnect(devp2p.RLPx.DISCONNECT_REASONS.USELESS_PEER)
    // }, ms('15s'))
    // peer.once('close', () => clearTimeout(forkDrop))
  })

  sec.on('message', async (code, payload) => {
    if (code in requests.msgTypes) {
      requests.msgTypes[code] += 1
    } else {
      requests.msgTypes[code] = 1
    }

    switch (code) {
      case devp2p.SEC.MESSAGE_CODES.STATUS:
        console.log(chalk.red('Doing STATUS Block...'))
        break
      case devp2p.SEC.MESSAGE_CODES.NEW_BLOCK_HASHES:
        // TODO: console
        console.log(chalk.red('NEW_BLOCK_HASHES'))
        if (!forkVerified) break
        for (let item of payload) {
          const blockHash = item[0]
          if (blocksCache.has(blockHash.toString('hex'))) continue
          setTimeout(() => {
            sec.sendMessage(devp2p.SEC.MESSAGE_CODES.GET_BLOCK_HEADERS, [blockHash, 1, 0, 0])
            requests.headers.push(blockHash)
          }, ms('0.1s'))
        }
        break

      case devp2p.SEC.MESSAGE_CODES.TX:
        // TODO: console
        console.log(chalk.red('TX'))
        if (!forkVerified) break
        for (let item of payload) {
          // Added
          console.log(item)
          // const tx = new SECTx(item)
          // if (isValidTx(tx)) onNewTx(tx, peer)
        }
        break

      case devp2p.SEC.MESSAGE_CODES.GET_BLOCK_HEADERS:
        // TODO: console
        console.log(chalk.red('GET_BLOCK_HEADERS'))
        const headers = []
        if (devp2p._util.buffer2int(payload[0]) === CHECK_BLOCK_NR) {
          headers.push(CHECK_BLOCK_HEADER)
        }
        if (requests.headers.length === 0 && requests.msgTypes[code] >= 8) {
          peer.disconnect(devp2p.RLPx.DISCONNECT_REASONS.USELESS_PEER)
        } else {
          sec.sendMessage(devp2p.SEC.MESSAGE_CODES.BLOCK_HEADERS, headers)
        }
        break

      case devp2p.SEC.MESSAGE_CODES.BLOCK_HEADERS:
        // TODO: console
        console.log(chalk.red('BLOCK_HEADERS'))
        if (!forkVerified) {
          if (payload.length !== 1) {
            console.log(`${addr} expected one header for ${CHECK_BLOCK_TITLE} verify (received: ${payload.length})`)
            peer.disconnect(devp2p.RLPx.DISCONNECT_REASONS.USELESS_PEER)
            break
          }
          const expectedHash = CHECK_BLOCK
          // Added
          console.log(expectedHash)
          // const header = new SECBlock.Header(payload[0])
          // if (header.hash().toString('hex') === expectedHash) {
          //   console.log(`${addr} verified to be on the same side of the ${CHECK_BLOCK_TITLE}`)
          //   clearTimeout(forkDrop)
          //   forkVerified = true
          // }
        } else {
          if (payload.length > 1) {
            console.log(`${addr} not more than one block header expected (received: ${payload.length})`)
            break
          }

          let isValidPayload = false
          // const header = new SECBlock.Header(payload[0])
          while (requests.headers.length > 0) {
            const blockHash = requests.headers.shift()
            // Added
            console.log(blockHash)
            // if (header.hash().equals(blockHash)) {
            //   isValidPayload = true
            //   setTimeout(() => {
            //     sec.sendMessage(devp2p.SEC.MESSAGE_CODES.GET_BLOCK_BODIES, [blockHash])
            //     requests.bodies.push(header)
            //   }, ms('0.1s'))
            //   break
            // }
          }
          if (!isValidPayload) {
            // Added
            console.log('inValidPayload')
            // console.log(`${addr} received wrong block header ${header.hash().toString('hex')}`)
          }
          // if (!isValidPayload) {
          //   console.log(`${addr} received wrong block header ${header.hash().toString('hex')}`)
          // }
        }
        break

      case devp2p.SEC.MESSAGE_CODES.GET_BLOCK_BODIES:
        // TODO: console
        console.log(chalk.red('GET_BLOCK_BODIES'))
        if (requests.headers.length === 0 && requests.msgTypes[code] >= 8) {
          peer.disconnect(devp2p.RLPx.DISCONNECT_REASONS.USELESS_PEER)
        } else {
          sec.sendMessage(devp2p.SEC.MESSAGE_CODES.BLOCK_BODIES, [])
        }
        break

      case devp2p.SEC.MESSAGE_CODES.BLOCK_BODIES:
        // TODO: console
        console.log(chalk.red('BLOCK_BODIES'))
        if (!forkVerified) break
        if (payload.length !== 1) {
          console.log(`${addr} not more than one block body expected (received: ${payload.length})`)
          break
        }
        let isValidPayload = false
        while (requests.bodies.length > 0) {
          const header = requests.bodies.shift()
          // Added
          console.log(header)
          // const block = new SECBlock([header.raw, payload[0][0], payload[0][1]])
          // const isValid = await isValidBlock(block)
          // if (isValid) {
          //   isValidPayload = true
          //   onNewBlock(block, peer)
          //   break
          // }
        }
        if (!isValidPayload) {
          console.log(`${addr} received wrong block body`)
        }
        break

      case devp2p.SEC.MESSAGE_CODES.NEW_BLOCK:
        // TODO: console
        console.log(chalk.red('NEW_BLOCK'))
        if (!forkVerified) break
        // Added
        console.log(payload[0])
        // const newBlock = new SECBlock(payload[0])
        // const isValidNewBlock = await isValidBlock(newBlock)
        // if (isValidNewBlock) onNewBlock(newBlock, peer)
        break
    }
  })
})

rlp.on('peer:removed', (peer, reasonCode, disconnectWe) => {
  const who = disconnectWe ? 'Disconnect' : 'Peer disconnect'
  const total = rlp.getPeers().length
  console.log(chalk.yellow(`RLP | peer:removed Event | Remove peer: ${getPeerAddr(peer)} - ${who}, reason: ${peer.getDisconnectPrefix(reasonCode)} (${String(reasonCode)}) (total: ${total})`))
})

rlp.on('peer:error', (peer, err) => {
  if (err.code === 'ECONNRESET') return
  if (err instanceof assert.AssertionError) {
    const peerId = peer.getId()
    if (peerId !== null) ndp.banPeer(peerId, ms('5m'))
    console.error(chalk.red(`RPL | peer:error Event | Peer Error (${getPeerAddr(peer)}): ${err.message}`))
    return
  }
  console.error(chalk.red(`RPL | peer:error Event | Peer error (${getPeerAddr(peer)}): ${err.stack || err}`))
})

rlp.on('error', err => console.error(chalk.red(`RLP | RLP error: ${err.stack || err}`)))

const getPeerAddr = (peer) => `${peer._socket.remoteAddress}:${peer._socket.remotePort}`

// const txCache = new LRUCache({
//   max: 1000
// })

// function onNewTx (tx, peer) {
//   const txHashHex = tx.hash().toString('hex')
//   if (txCache.has(txHashHex)) return
//   txCache.set(txHashHex, true)
//   console.log(`New tx: ${txHashHex} (from ${getPeerAddr(peer)})`)
// }

const blocksCache = new LRUCache({
  max: 100
})

// function onNewBlock (block, peer) {
//   const blockHashHex = block.hash().toString('hex')
//   const blockNumber = devp2p._util.buffer2int(block.header.number)
//   if (blocksCache.has(blockHashHex)) return
//   blocksCache.set(blockHashHex, true)
//   console.log('----------------------------------------------------------------------------------------------------------')
//   console.log(`New block ${blockNumber}: ${blockHashHex} (from ${getPeerAddr(peer)})`)
//   console.log('----------------------------------------------------------------------------------------------------------')
//   for (let tx of block.transactions) onNewTx(tx, peer)
// }

// function isValidTx (tx) {
//   return tx.validate(false)
// }

// async function isValidBlock (block) {
//   if (!block.validateUnclesHash()) return false
//   if (!block.transactions.every(isValidTx)) return false
//   return new Promise((resolve, reject) => {
//     block.genTxTrie(() => {
//       try {
//         resolve(block.validateTransactionsTrie())
//       } catch (err) {
//         reject(err)
//       }
//     })
//   })
// }

// accept incoming connections
rlp.listen(13331, '0.0.0.0')

// for debug
// nodes.forEach((node) => {
//   ndp.addPeer({
//     address: node.ip,
//     udpPort: node.port,
//     tcpPort: node.port
//   }).then((peer) => {
//     console.log(chalk.green(`  Add Peer: ${peer.id.toString('hex')}, ${peer.address}:${peer.udpPort}:${peer.tcpPort}`))
//   }).catch((err) => console.log(`error on connection to local node: ${err.stack || err}`))
// })

// add bootstrap nodes
const BOOTNODES = nodes.map((node) => {
  return {
    address: node.ip,
    udpPort: node.port,
    tcpPort: node.port
  }
})
for (let bootnode of BOOTNODES) {
  ndp.bootstrap(bootnode).catch((err) => console.error(chalk.bold.red(err.stack || err)))
}

setInterval(() => {
  const peers = ndp.getPeers()
  const peersCount = peers.length
  const rlpPeers = rlp.getPeers()
  const openSlots = rlp._getOpenSlots()
  const queueLength = rlp._peersQueue.length
  const queueLength2 = rlp._peersQueue.filter((o) => o.ts <= Date.now()).length
  console.log(chalk.yellow(`Total nodes in NDP: ${peersCount}, RLP Info: peers: ${rlpPeers.length}, open slots: ${openSlots}, queue: ${queueLength} / ${queueLength2}`))
  rlpPeers.forEach((peer, index) => {
    console.log(chalk.yellow(`    Peer ${index + 1} : ${getPeerAddr(peer)}) in RLP`))
  })
}, ms('5s'))
