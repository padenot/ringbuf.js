// tests/demo.js
import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { RingBuffer } from '../dist/index.mjs';
import { Worker } from 'worker_threads';
import fs from 'fs';
import { SequenceGenerator, SequenceVerifier, SeededPRNG } from './test-utils.mjs'

test('linearized symmetrical push/pop', () => {
  var iterationsTotal = 1000;
  var iteration = iterationsTotal;
  var rng = new SeededPRNG();
  while (iteration--) {
    var arraySize = rng.randomInt(48000);
    var pushPopSize = Math.round(rng.random() * arraySize);
    console.info(`Starting iteration ${iterationsTotal - iteration} of ${iterationsTotal}, SAB size: ${arraySize}, push/pop size: ${pushPopSize}`);
    var storage = RingBuffer.getStorageForCapacity(arraySize, Uint32Array);
    var rb = new RingBuffer(storage, Uint32Array);
    var toPush = new Uint32Array(pushPopSize);
    var toPop = new Uint32Array(pushPopSize);
    var generator = new SequenceGenerator;
    var verifier = new SequenceVerifier;
    // Go around the ring buffer about 100 times for each test case
    var step = Math.round(arraySize * 100 / pushPopSize);
    while (step--) {
      generator.fill(toPush);
      var pushed = rb.push(toPush);
      assert.equal(rb.available_read(), toPush.length);
      assert.equal(rb.available_write(), rb.capacity() - toPush.length);
      rb.pop(toPop);
      assert.equal(rb.available_read(), 0);
      assert.equal(rb.available_write(), rb.capacity());
      verifier.check(toPop);
    }
  }
});

test('linarized asymmetrical push/pop', () => {
  var iterationsTotal = 1000;
  var iteration = iterationsTotal;
  var rng = new SeededPRNG();
  while (iteration--) {
    var arraySize = rng.randomInt(48000);
    var pushSize = Math.round(rng.random() * arraySize);
    var popSize = Math.round(rng.random() * arraySize);
    console.info(`Starting iteration ${iterationsTotal - iteration} of ${iterationsTotal}, SAB size: ${arraySize}, push size: ${pushSize}, pop size: ${popSize}`);
    var storage = RingBuffer.getStorageForCapacity(arraySize, Uint32Array);
    var rb = new RingBuffer(storage, Uint32Array);
    assert.ok(rb.empty() && !rb.full());
    var toPush = new Uint32Array(pushSize);
    var toPop = new Uint32Array(popSize);
    var generator = new SequenceGenerator;
    var verifier = new SequenceVerifier;
    // Go around the ring buffer about 100 times for each test case
    var step = Math.round(arraySize * 100 / pushSize);
    var external_length = 0;
      while (step--) {
      var to_write = Math.min(rb.available_write(), toPush.length);
      generator.fill(toPush, to_write);
      external_length += to_write;
      rb.push(toPush, to_write);
      assert.equal(rb.available_read(), external_length);
      assert.equal(rb.available_write(), rb.capacity() - external_length);
      var popped = rb.pop(toPop);
      external_length -= popped
      assert.equal(rb.available_read(), external_length);
      assert.equal(rb.available_write(), rb.capacity() - external_length);
      verifier.check(toPop, popped);
    }
  }
});

test('linearized asymmetrical random push/pop', () => {
  var iterationsTotal = 1000;
  var iteration = iterationsTotal;
  var rng = new SeededPRNG();
  while (iteration--) {
    var arraySize = rng.randomInt(48000);
    var maxPushSize = Math.round(rng.random() * arraySize);
    var maxPopSize = Math.round(rng.random() * arraySize);
    console.info(`Starting iteration ${iterationsTotal - iteration} of ${iterationsTotal}, SAB size: ${arraySize}, max push size: ${maxPushSize}, max pop size: ${maxPopSize}`);
    var storage = RingBuffer.getStorageForCapacity(arraySize, Uint32Array);
    var rb = new RingBuffer(storage, Uint32Array);
    assert.ok(rb.empty() && !rb.full());
    var toPush = new Uint32Array(maxPushSize);
    var toPop = new Uint32Array(maxPopSize);
    var generator = new SequenceGenerator;
    var verifier = new SequenceVerifier;
    // Go around the ring buffer about 100 times for each test case
    var step = Math.round(arraySize * 100 / maxPushSize);
    var external_length = 0;
      while (step--) {
      var max_to_write = Math.min(rb.available_write(), toPush.length);
      var to_write = rng.randomInt(max_to_write);

      generator.fill(toPush, to_write);
      external_length += to_write;
      rb.push(toPush, to_write);
      assert.equal(rb.available_read(), external_length);
      assert.equal(rb.available_write(), rb.capacity() - external_length);
      var to_pop = rng.randomInt(maxPopSize);
      var popped = rb.pop(toPop, to_pop);
      external_length -= popped
      assert.equal(rb.available_read(), external_length);
      assert.equal(rb.available_write(), rb.capacity() - external_length);
      verifier.check(toPop, popped);
    }
  }
});

function oneIteration(iteration, iterationsTotal, rng, worker) {
  return new Promise((resolve, reject) => {
    worker.once("message", (e) => { done = true; });
    var arraySize = rng.randomInt(48000);
    var pushPopSize = Math.round(rng.random() * arraySize);
    var sab = RingBuffer.getStorageForCapacity(arraySize, Uint32Array);
    var rb = new RingBuffer(sab, Uint32Array);
    console.info(`Starting iteration ${iterationsTotal - iteration + 1} of ${iterationsTotal}, SAB size: ${arraySize}, push/pop size: ${pushPopSize}`);
    var storage = RingBuffer.getStorageForCapacity(arraySize, Uint32Array);
    worker.postMessage({ name: "seq-constant", sharedArrayBuffer: sab, params: [pushPopSize] });
    var toPop = new Uint32Array(pushPopSize);
    var verifier = new SequenceVerifier;
    var done = false;
    function tryPop() {
      while (rb.available_read() >= pushPopSize) {
        rb.pop(toPop);
        verifier.check(toPop);
      }
      if (!done) {
        setTimeout(tryPop.bind(this), 0);
      } else {
        resolve();
      }
    }
    tryPop();
  });
}

test('SPSC asymmetrical random push/pop', async () => {
  var worker = new Worker("./tests/worker.js");
  var p = new Promise((resolve, reject) => {
    worker.once("message", async (e) => {
      if (e == "ok") {
        var iterationsTotal = 100;
        var iteration = iterationsTotal;
        var rng = new SeededPRNG(13);
        while (iteration) {
          await oneIteration(iteration--, iterationsTotal, rng, worker);
        }
        resolve();
      }
    });
  })
  await p;
});

test.run();
