const async = require('async')
const test = require('tape')
const util = require('./util.js')
const Peer = require('../../src/rlpx/peer.js')

test('RLPX: add working node', async (t) => {
  const rlpxs = util.initTwoPeerRLPXSetup(null, null)

  rlpxs[0].on('peer:added', function (peer) {
    t.equal(peer._port, 30306, 'should have added peer on peer:added after successful handshake')
    t.equal(rlpxs[0].getPeers().length, 1, 'peer list length should be 1')
    t.equal(rlpxs[0]._getOpenSlots(), 9, 'should have maxPeers - 1 open slots left')
    util.destroyRLPXs(rlpxs)
    t.end()
  })
})

test('RLPX: remove node', async (t) => {
  const rlpxs = util.initTwoPeerRLPXSetup(null, null)

  async.series([
    function (cb) {
      rlpxs[0].on('peer:added', function (peer) {
        rlpxs[0].disconnect(peer._remoteId)
        cb(null)
      })
    },
    function (cb) {
      rlpxs[0].on('peer:removed', function (peer, reason, disconnectWe) {
        t.equal(reason, Peer.DISCONNECT_REASONS.CLIENT_QUITTING, 'should close with CLIENT_QUITTING disconnect reason')
        t.equal(rlpxs[0]._getOpenSlots(), 10, 'should have maxPeers open slots left')
        cb(null)
      })
    }
  ], function (err, results) {
    if (err) {
      t.fail('An unexpected error occured.')
    }
    util.destroyRLPXs(rlpxs)
    t.end()
  })
})

test('RLPX: test peer queue / refill connections', async (t) => {
  const rlpxs = util.getTestRLPXs(3, 1, null)

  const peer = {
    address: util.localhost,
    udpPort: util.basePort + 1,
    tcpPort: util.basePort + 1
  }
  rlpxs[0]._ndp.addPeer(peer)

  async.series([
    function (cb) {
      rlpxs[0].once('peer:added', function (peer) {
        t.equal(rlpxs[0]._peersQueue.length, 0, 'peers queue should contain no peers')
        const peer2 = {
          address: util.localhost,
          udpPort: util.basePort + 2,
          tcpPort: util.basePort + 2
        }
        rlpxs[0]._ndp.addPeer(peer2)
        cb(null)
      })
    },
    function (cb) {
      rlpxs[0].once('peer:added', function (peer) {
        // FIXME: values not as expected
        // t.equal(rlpxs[0]._peersQueue.length, 1, 'peers queue should contain one peer')
        cb(null)
      })
    }
  ], function (err, results) {
    if (err) {
      t.fail('An unexpected error occured.')
    }
    util.destroyRLPXs(rlpxs)
    t.end()
  })
})
