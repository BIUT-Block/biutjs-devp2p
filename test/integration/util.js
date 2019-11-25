const devp2p = require('../../src')

const localhost = '127.0.0.1'
const basePort = 30306

exports.getTestNDPs = function (numNDPs) {
  const ndps = []

  for (let i = 0; i < numNDPs; ++i) {
    const ndp = new devp2p.NDP(devp2p._util.genPrivateKey(), {
      endpoint: {
        address: localhost,
        udpPort: basePort + i,
        tcpPort: basePort + i
      },
      timeout: 100
    })
    ndp.bind(basePort + i)
    ndps.push(ndp)
  }
  return ndps
}

exports.initTwoPeerNDPSetup = function () {
  const ndps = exports.getTestNDPs(2)
  const peer = {
    address: localhost,
    udpPort: basePort + 1
  }
  ndps[0].addPeer(peer)
  return ndps
}

exports.destroyNDPs = function (ndps) {
  for (let ndp of ndps) ndp.destroy()
}

exports.getTestRLPXs = function (numRLPXs, maxPeers, capabilities) {
  const rlpxs = []
  if (!capabilities) {
    capabilities = [
      devp2p.SEC.eth63,
      devp2p.SEC.sec
    ]
  }
  const ndps = exports.getTestNDPs(numRLPXs)

  for (let i = 0; i < numRLPXs; ++i) {
    const rlpx = new devp2p.RLPx(ndps[i]._privateKey, {
      ndp: ndps[i],
      maxPeers: maxPeers,
      capabilities: capabilities,
      listenPort: basePort + i
    })
    rlpx.listen(basePort + i)
    rlpxs.push(rlpx)
  }
  return rlpxs
}

exports.initTwoPeerRLPXSetup = function (maxPeers, capabilities) {
  const rlpxs = exports.getTestRLPXs(2, maxPeers, capabilities)
  const peer = {
    address: localhost,
    udpPort: basePort + 1,
    tcpPort: basePort + 1
  }
  rlpxs[0]._ndp.addPeer(peer)
  return rlpxs
}

/**
 * @param {Test} t
 * @param {Array} capabilities Capabilities
 * @param {Object} opts
 * @param {Dictionary} opts.status0 Status values requested by protocol
 * @param {Dictionary} opts.status1 Status values requested by protocol
 * @param {Function} opts.onOnceStatus0 (rlpxs, protocol) Optional handler function
 * @param {Function} opts.onPeerError0 (err, rlpxs) Optional handler function
 * @param {Function} opts.onPeerError1 (err, rlpxs) Optional handler function
 * @param {Function} opts.onOnMsg0 (rlpxs, protocol, code, payload) Optional handler function
 * @param {Function} opts.onOnMsg1 (rlpxs, protocol, code, payload) Optional handler function
 */
exports.twoPeerMsgExchange = function (t, capabilities, opts) {
  const rlpxs = exports.initTwoPeerRLPXSetup(null, capabilities)
  rlpxs[0].on('peer:added', function (peer) {
    const protocol = peer.getProtocols()[0]
    protocol.sendStatus(opts.status0) // (1 ->)

    protocol.once('status', () => {
      if (opts.onOnceStatus0) opts.onOnceStatus0(rlpxs, protocol)
    }) // (-> 2)
    protocol.on('message', async (code, payload) => {
      if (opts.onOnMsg0) opts.onOnMsg0(rlpxs, protocol, code, payload)
    })
    peer.on('error', (err) => {
      if (opts.onPeerError0) {
        opts.onPeerError0(err, rlpxs)
      } else {
        console.log(`Unexpected peer 0 error: ${err}`)
      }
    }) // (-> 2)
  })

  rlpxs[1].on('peer:added', function (peer) {
    const protocol = peer.getProtocols()[0]
    protocol.on('message', async (code, payload) => {
      switch (code) {
        // Comfortability hack, use constants like devp2p.SEC.MESSAGE_CODES.STATUS
        // in production use
        case 0x00: // (-> 1)
          t.pass('should receive initial status message')
          protocol.sendStatus(opts.status1) // (2 ->)
          break
      }
      if (opts.onOnMsg1) opts.onOnMsg1(rlpxs, protocol, code, payload)
    })
    peer.on('error', (err) => {
      if (opts.onPeerError1) {
        opts.onPeerError1(err, rlpxs)
      } else {
        console.log(`Unexpected peer 1 error: ${err}`)
      }
    })
  })
}

exports.destroyRLPXs = function (rlpxs) {
  for (let rlpx of rlpxs) {
    // FIXME: Call destroy() on ndp instance from the rlpx.destroy() method
    rlpx._ndp.destroy()
    rlpx.destroy()
  }
}

exports.localhost = localhost
exports.basePort = basePort
