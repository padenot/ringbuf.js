const ringbuf = require("../dist/index.js");
const { parentPort } = require("worker_threads");

import("./test-utils.mjs").then((mod) => {
  parentPort.postMessage("ok");
  const tests = {
    "seq-constant": (data) => {
      const sab = data.sharedArrayBuffer;
      const packetSize = data.params[0];
      const arraySize = sab.byteLength / Uint32Array.BYTES_PER_ELEMENT;
      const rb = new ringbuf.RingBuffer(sab, Uint32Array);
      const toPush = new Uint32Array(packetSize);
      const generator = new mod.SequenceGenerator();
      // Go around the ring buffer about 1000 times for each test case
      let step = Math.round((arraySize * 1000) / packetSize);
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
    },
  };

  parentPort.on("message", (m) => {
    tests[m.name](m);
  });
});
