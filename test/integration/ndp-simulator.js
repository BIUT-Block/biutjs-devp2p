const async = require('async')
const test = require('tape')
const util = require('./util.js')

async function delay (ms) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

test('NDP: new working node', async (t) => {
  const ndps = util.initTwoPeerNDPSetup()

  ndps[0].on('peer:new', function (peer) {
    t.equal(peer.address, '127.0.0.1', 'should have added peer on peer:new')
    util.destroyNDPs(ndps)
    t.end()
  })
})

test('NDP: working node added', async (t) => {
  const ndps = util.initTwoPeerNDPSetup()

  ndps[0].on('peer:added', function (peer) {
    t.equal(ndps[0].getPeers().length, 1, 'should have added peer to k-bucket on peer:added')
    util.destroyNDPs(ndps)
    t.end()
  })
})

test('NDP: remove node', async (t) => {
  const ndps = util.initTwoPeerNDPSetup()

  async.series([function (cb) {
    ndps[0].on('peer:added', function (peer) {
      ndps[0].removePeer(peer)
      cb(null)
    })
  }, function (cb) {
    ndps[0].on('peer:removed', function (peer) {
      t.equal(ndps[0].getPeers().length, 0, 'should have removed peer from k-bucket on peer:removed')
      cb(null)
    })
  }], function (err, results) {
    if (err) {
      t.fail('An unexpected error occured.')
    }
    util.destroyNDPs(ndps)
    t.end()
  })
})

test('NDP: ban node', async (t) => {
  const ndps = util.initTwoPeerNDPSetup()

  async.series([function (cb) {
    ndps[0].on('peer:added', function (peer) {
      ndps[0].banPeer(peer)
      cb(null)
    })
  }, function (cb) {
    ndps[0].on('peer:removed', function (peer) {
      t.equal(ndps[0]._banlist.has(peer), true, 'ban-list should contain peer')
      t.equal(ndps[0].getPeers().length, 0, 'should have removed peer from k-bucket on peer:removed')
      cb(null)
    })
  }], function (err, results) {
    if (err) {
      t.fail('An unexpected error occured.')
    }
    util.destroyNDPs(ndps)
    t.end()
  })
})

test('NDP: k-bucket ping', async (t) => {
  const ndps = util.initTwoPeerNDPSetup()

  async.series([function (cb) {
    ndps[0].on('peer:added', function (peer) {
      ndps[0]._onKBucketPing([peer], peer)
      setTimeout(function () {
        cb(null)
      }, 400)
    })
  }, function (cb) {
    t.equal(ndps[0].getPeers().length, 1, 'should still have one peer in k-bucket')
    cb(null)
  }], function (err, results) {
    if (err) {
      t.fail('An unexpected error occured.')
    }
    util.destroyNDPs(ndps)
    t.end()
  })
})

test('NDP: add non-available node', async (t) => {
  const ndps = util.getTestNDPs(1)
  const peer = {
    address: util.localhost,
    udpPort: util.basePort + 1
  }

  await ndps[0].addPeer(peer).catch((e) => {
    t.equal(e.message, 'Timeout error: ping 127.0.0.1:30307', 'should throw Timeout error')
    util.destroyNDPs(ndps)
    t.end()
  })
})

test('NDP: simulate bootstrap', async (t) => {
  const numNDPs = 6
  const ndps = util.getTestNDPs(numNDPs)

  await delay(250)
  await ndps[0].addPeer({
    address: util.localhost,
    udpPort: util.basePort + 1
  })
  await delay(100)

  for (let ndp of ndps.slice(2)) {
    await ndp.bootstrap({
      address: util.localhost,
      udpPort: util.basePort + 1
    })
  }

  for (let ndp of ndps) {
    ndp.refresh()
    await delay(400)
  }

  await delay(250)
  util.destroyNDPs(ndps)

  // ndps.forEach((ndp, i) => console.log(`${i}:${ndp.getPeers().length}`))
  for (let ndp of ndps) t.equal(ndp.getPeers().length, numNDPs, 'Peers should be distributed to all NDPs')

  t.end()
})
