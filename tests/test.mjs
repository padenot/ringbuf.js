// tests/demo.js
import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { RingBuffer } from '../dist/index.mjs';

/* seedable good enough prng */
function mulberry32(a) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

/* seeded good enough prng */
var seededPRNG = mulberry32(11 /* 11 sounds good */)

/* seedable good enough prng between 0 and max */
var seededIntegerPRNG = function(max) {
  return Math.round(seededPRNG() * max);
}

// Generates a sequence of integers
class SequenceGenerator {
  constructor() {
    this.index = 0;
  }
  next() {
    return this.index++;
  }
  fill(array, elementCount) {
    var len = elementCount != undefined ? elementCount : array.length;
    for (var i = 0; i < len; i++) {
      array[i] = this.next();
    }
  }
  reset() {
    this.index = 0;
  }
}

// Checks that a series of integers is a sequence
class SequenceVerifier {
  constructor() {
    this.index = 0;
  }
  check(toCheck, elementCount) {
    if (typeof toCheck == Number) {
      assert.equal(this.index, toCheck);
      this.index++;
    } else if (toCheck.length != undefined) {
      var len = elementCount != undefined ? elementCount : toCheck.length;
      for (var i = 0; i < len; i++) {
        assert.equal(this.index, toCheck[i]);
        this.index++;
      }
    }
  }
  reset() {
    index = 0;
  }
}

test('linearized symmetrical push/pop', () => {
  var iterationsTotal = 1000;
  var iteration = iterationsTotal;
  while (iteration--) {
    var arraySize = seededIntegerPRNG(48000);
    var pushPopSize = Math.round(seededPRNG() * arraySize);
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
  while (iteration--) {
    var arraySize = seededIntegerPRNG(48000);
    var pushSize = Math.round(seededPRNG() * arraySize);
    var popSize = Math.round(seededPRNG() * arraySize);
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
  while (iteration--) {
    var arraySize = seededIntegerPRNG(48000);
    var maxPushSize = Math.round(seededPRNG() * arraySize);
    var maxPopSize = Math.round(seededPRNG() * arraySize);
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
      var to_write = seededIntegerPRNG(max_to_write);

      generator.fill(toPush, to_write);
      external_length += to_write;
      rb.push(toPush, to_write);
      assert.equal(rb.available_read(), external_length);
      assert.equal(rb.available_write(), rb.capacity() - external_length);
      var to_pop = seededIntegerPRNG(maxPopSize);
      var popped = rb.pop(toPop, to_pop);
      external_length -= popped
      assert.equal(rb.available_read(), external_length);
      assert.equal(rb.available_write(), rb.capacity() - external_length);
      verifier.check(toPop, popped);
    }
  }
});

test.run();
