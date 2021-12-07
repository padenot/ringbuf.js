// tests/demo.js
import { test } from "uvu";
import * as assert from "uvu/assert";
import { RingBuffer } from "../dist/index.mjs";
import { Worker } from "worker_threads";
import {
  SequenceGenerator,
  SequenceVerifier,
  SeededPRNG,
} from "./test-utils.mjs";

test("linearized symmetrical push/pop", () => {
  const iterationsTotal = 1000;
  let iteration = iterationsTotal;
  const rng = new SeededPRNG();
  while (iteration--) {
    const arraySize = rng.randomInt(48000);
    const pushPopSize = Math.round(rng.random() * arraySize);
    console.info(
      `Starting iteration ${
        iterationsTotal - iteration
      } of ${iterationsTotal}, SAB size: ${arraySize}, push/pop size: ${pushPopSize}`
    );
    const storage = RingBuffer.getStorageForCapacity(arraySize, Uint32Array);
    const rb = new RingBuffer(storage, Uint32Array);
    const toPush = new Uint32Array(pushPopSize);
    const toPop = new Uint32Array(pushPopSize);
    const generator = new SequenceGenerator();
    const verifier = new SequenceVerifier();
    // Go around the ring buffer about 100 times for each test case
    let step = Math.round((arraySize * 100) / pushPopSize);
    while (step--) {
      generator.fill(toPush);
      rb.push(toPush);
      assert.equal(rb.available_read(), toPush.length);
      assert.equal(rb.available_write(), rb.capacity() - toPush.length);
      rb.pop(toPop);
      assert.equal(rb.available_read(), 0);
      assert.equal(rb.available_write(), rb.capacity());
      verifier.check(toPop);
    }
  }
});

test("linarized asymmetrical push/pop", () => {
  const iterationsTotal = 1000;
  let iteration = iterationsTotal;
  const rng = new SeededPRNG();
  while (iteration--) {
    const arraySize = rng.randomInt(48000);
    const pushSize = Math.round(rng.random() * arraySize);
    const popSize = Math.round(rng.random() * arraySize);
    console.info(
      `Starting iteration ${
        iterationsTotal - iteration
      } of ${iterationsTotal}, SAB size: ${arraySize}, push size: ${pushSize}, pop size: ${popSize}`
    );
    const storage = RingBuffer.getStorageForCapacity(arraySize, Uint32Array);
    const rb = new RingBuffer(storage, Uint32Array);
    assert.ok(rb.empty() && !rb.full());
    const toPush = new Uint32Array(pushSize);
    const toPop = new Uint32Array(popSize);
    const generator = new SequenceGenerator();
    const verifier = new SequenceVerifier();
    // Go around the ring buffer about 100 times for each test case
    let step = Math.round((arraySize * 100) / pushSize);
    let external_length = 0;
    while (step--) {
      const to_write = Math.min(rb.available_write(), toPush.length);
      generator.fill(toPush, to_write);
      external_length += to_write;
      rb.push(toPush, to_write);
      assert.equal(rb.available_read(), external_length);
      assert.equal(rb.available_write(), rb.capacity() - external_length);
      const popped = rb.pop(toPop);
      external_length -= popped;
      assert.equal(rb.available_read(), external_length);
      assert.equal(rb.available_write(), rb.capacity() - external_length);
      verifier.check(toPop, popped);
    }
  }
});

test("linearized asymmetrical random push/pop", () => {
  const iterationsTotal = 1000;
  let iteration = iterationsTotal;
  const rng = new SeededPRNG();
  while (iteration--) {
    const arraySize = rng.randomInt(48000);
    const maxPushSize = Math.round(rng.random() * arraySize);
    const maxPopSize = Math.round(rng.random() * arraySize);
    console.info(
      `Starting iteration ${
        iterationsTotal - iteration
      } of ${iterationsTotal}, SAB size: ${arraySize}, max push size: ${maxPushSize}, max pop size: ${maxPopSize}`
    );
    const storage = RingBuffer.getStorageForCapacity(arraySize, Uint32Array);
    const rb = new RingBuffer(storage, Uint32Array);
    assert.ok(rb.empty() && !rb.full());
    const toPush = new Uint32Array(maxPushSize);
    const toPop = new Uint32Array(maxPopSize);
    const generator = new SequenceGenerator();
    const verifier = new SequenceVerifier();
    // Go around the ring buffer about 100 times for each test case
    let step = Math.round((arraySize * 100) / maxPushSize);
    let external_length = 0;
    while (step--) {
      const max_to_write = Math.min(rb.available_write(), toPush.length);
      const to_write = rng.randomInt(max_to_write);

      generator.fill(toPush, to_write);
      external_length += to_write;
      rb.push(toPush, to_write);
      assert.equal(rb.available_read(), external_length);
      assert.equal(rb.available_write(), rb.capacity() - external_length);
      const to_pop = rng.randomInt(maxPopSize);
      const popped = rb.pop(toPop, to_pop);
      external_length -= popped;
      assert.equal(rb.available_read(), external_length);
      assert.equal(rb.available_write(), rb.capacity() - external_length);
      verifier.check(toPop, popped);
    }
  }
});

function oneIteration(iteration, iterationsTotal, rng, worker) {
  return new Promise((resolve, _reject) => {
    let done = false;
    worker.once("message", (_e) => {
      done = true;
    });
    const arraySize = rng.randomInt(48000);
    const pushPopSize = Math.round(rng.random() * arraySize);
    const sab = RingBuffer.getStorageForCapacity(arraySize, Uint32Array);
    const rb = new RingBuffer(sab, Uint32Array);
    console.info(
      `Starting iteration ${
        iterationsTotal - iteration + 1
      } of ${iterationsTotal}, SAB size: ${arraySize}, push/pop size: ${pushPopSize}`
    );
    worker.postMessage({
      name: "seq-constant",
      sharedArrayBuffer: sab,
      params: [pushPopSize],
    });
    const toPop = new Uint32Array(pushPopSize);
    const verifier = new SequenceVerifier();
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

test("SPSC asymmetrical random push/pop", async () => {
  const worker = new Worker("./tests/worker.js");
  const p = new Promise((resolve, _reject) => {
    worker.once("message", async (e) => {
      if (e === "ok") {
        const iterationsTotal = 100;
        let iteration = iterationsTotal;
        const rng = new SeededPRNG(13);
        while (iteration) {
          await oneIteration(iteration--, iterationsTotal, rng, worker);
        }
        resolve();
      }
    });
  });
  await p;
  worker.terminate();
});

test.run();
