import * as assert from "uvu/assert";

class SeededPRNG {
  constructor(seed = 11 /* 11 sounds good */) {
    /* seedable good enough prng */
    function mulberry32(a) {
      return function () {
        let t = (a += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    /* seeded good enough prng */
    this.seededPRNG = mulberry32(seed);
  }
  /* seedable good enough prng between 0 and max */
  randomInt(max = 2 << 31) {
    return Math.round(this.seededPRNG() * max);
  }
  /* seedable good enough prng between 0.0 and 1.0 */
  random() {
    return this.seededPRNG();
  }
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
    const len = elementCount != undefined ? elementCount : array.length;
    for (let i = 0; i < len; i++) {
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
    if (typeof toCheck === Number) {
      assert.equal(this.index, toCheck);
      this.index++;
    } else if (toCheck.length != undefined) {
      const len = elementCount != undefined ? elementCount : toCheck.length;
      for (let i = 0; i < len; i++) {
        assert.equal(this.index, toCheck[i]);
        this.index++;
      }
    }
  }
  reset() {
    index = 0;
  }
}

export { SequenceVerifier, SequenceGenerator, SeededPRNG };
