var ringbuf = require('../dist/index.js');
const { parentPort } = require('worker_threads');
var process = require("process");
import('./test-utils.mjs').then((mod) => {
  parentPort.postMessage("ok");
  var tests = {
    "seq-constant": (data) => {
      var sab = data.sharedArrayBuffer;
      var packetSize = data.params[0];
      var arraySize = sab.byteLength / Uint32Array.BYTES_PER_ELEMENT;
      var rb = new ringbuf.RingBuffer(sab, Uint32Array);
      var toPush = new Uint32Array(packetSize);
      var generator = new mod.SequenceGenerator;
      // Go around the ring buffer about 1000 times for each test case
      var step = Math.round(arraySize * 1000 / packetSize);
      function onestep() {
        while (rb.available_write() >= toPush.length) {
          generator.fill(toPush);
          step--;
          rb.push(toPush);
        }
        if (step > 0) {
          setTimeout(onestep);
        } else {
          parentPort.postMessage("done");
        }
      }
      onestep();
    }
  };

  parentPort.on("message", (m) => {
    tests[m.name](m)
  });
});

