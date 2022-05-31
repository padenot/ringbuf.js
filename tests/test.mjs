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

function checkNoCanaryTouched(array) {
  for (var i = 2; i < array.length - 4; i++) {
    assert.is.not(array[i] == Infinity, `Input canary found in output array at index ${i}`);
  }
  assert.ok(Number.isNaN(array[0]), `Output canary overwritten at index 0`);
  assert.ok(Number.isNaN(array[1]), `Output canary overwritten at index 1`);
  assert.ok(Number.isNaN(array[array.length - 1]), `Output canary overwritten at index ${array.length - 1}`);
  assert.ok(Number.isNaN(array[array.length - 2]), `Output canary overwritten at index ${array.length - 2}`);
}

test("linearized symmetrical push/pop w/ offset", () => {
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
    const canarySize = 4;
    const storage = RingBuffer.getStorageForCapacity(arraySize, Float32Array);
    const rb = new RingBuffer(storage, Float32Array);
    const toPush = new Float32Array(pushPopSize + canarySize);
    const toPop = new Float32Array(pushPopSize + canarySize);
    // Surrounding the data, are 2 Infinity on each side in the input array, 2
    // NaN on each side in the output array. This test checks that they are not
    // overwritten.
    toPush[0] = toPush[1] = toPush[toPush.length - 1] = toPush[toPush.length - 2] = Infinity;
    toPop[0] = toPop[1] = toPop[toPop.length - 1] = toPop[toPop.length - 2] = Number.NaN;
    const generator = new SequenceGenerator();
    const verifier = new SequenceVerifier();
    // Go around the ring buffer about 100 times for each test case
    let step = Math.round((arraySize * 100) / pushPopSize);
    while (step--) {
      generator.fill(toPush, pushPopSize, 2);
      rb.push(toPush, pushPopSize, 2);
      assert.equal(rb.available_read(), pushPopSize);
      assert.equal(rb.available_write(), rb.capacity() - pushPopSize);
      rb.pop(toPop, pushPopSize, 2);
      checkNoCanaryTouched(toPop);
      assert.equal(rb.available_read(), 0);
      assert.equal(rb.available_write(), rb.capacity());
      verifier.check(toPop, pushPopSize, 2);
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

test("linarized asymmetrical writeCallback/pop", () => {
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
      external_length += to_write;
      rb.writeCallback(to_write, function(first, second) {
        generator.fill(first, first.length);
        generator.fill(second, second.length);
      });
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

test("linarized asymmetrical writeCallbackWithOffset/pop", () => {
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
      external_length += to_write;
      rb.writeCallbackWithOffset(to_write, function(buf, first_offset, first_len, second_offset, second_len) {
        generator.fill(buf, first_len, first_offset);
        generator.fill(buf, second_len, second_offset);
      });
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
  const iterationsTotal = 1;
  let iteration = iterationsTotal;
  const rng = new SeededPRNG();
  while (iteration--) {
    const arraySize = rng.randomInt(48000);
    const maxPushSize = Math.round(rng.random() * arraySize);
    const maxPopSize = Math.round(rng.random() * arraySize);
    const desc = `SAB size: ${arraySize}, max push size: ${maxPushSize}, max pop size: ${maxPopSize}`;
    console.info(
      `Starting iteration ${
        iterationsTotal - iteration
      } of ${iterationsTotal} ` + desc);
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
      const stepStr = desc + `(${step})`;
      const max_to_write = Math.min(rb.available_write(), toPush.length);
      const to_write = rng.randomInt(max_to_write);
      generator.fill(toPush, to_write);
      external_length += to_write;
      rb.push(toPush, to_write);
      assert.equal(rb.available_read(), external_length, stepStr);
      assert.equal(rb.available_write(), rb.capacity() - external_length, stepStr);
      const to_pop = rng.randomInt(maxPopSize);
      const popped = rb.pop(toPop, to_pop);
      external_length -= popped;
      assert.equal(rb.available_read(), external_length, stepStr);
      assert.equal(rb.available_write(), rb.capacity() - external_length, stepStr);
      verifier.check(toPop, popped, 0, stepStr);
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
