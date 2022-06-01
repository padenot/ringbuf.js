/**
 * Send parameter changes, lock free, no gc, between a UI thread (browser
 * main thread or worker) and a real-time thread (in an AudioWorkletProcessor).
 * Write and Reader cannot change role after setup, unless externally
 * synchronized.
 *
 * GC _can_ happen during the initial construction of this object when hopefully
 * no audio is being output. This depends on the implementation.
 *
 * Parameter changes are like in the VST framework: an index and a float value
 * (no restriction on the value).
 *
 * This class supports up to 256 parameters, but this is easy to extend if
 * needed.
 *
 * An element is an index, that is an unsigned byte, and a float32, which is 4
 * bytes.
 */
export class ParameterWriter {
  /**
   * From a RingBuffer, build an object that can enqueue a parameter change in
   * the queue.
   * @param {RingBuffer} ringbuf A RingBuffer object of Uint8Array.
   * @constructor
   */
  constructor(ringbuf) {
    if (ringbuf.type() !== "Uint8Array") {
      throw TypeError("This class requires a ring buffer of Uint8Array");
    }
    const SIZE_ELEMENT = 5;
    this.ringbuf = ringbuf;
    this.mem = new ArrayBuffer(SIZE_ELEMENT);
    this.array = new Uint8Array(this.mem);
    this.view = new DataView(this.mem);
  }
  /*
   * Enqueue a parameter change for parameter of index `index`, with a new value
   * of `value`.
   *
   * @param {number} index The index of the parameter.
   * @param {number} value The value of the parameter.
   * @return True if enqueuing suceeded, false otherwise.
   */
  enqueue_change(index, value) {
    const SIZE_ELEMENT = 5;
    this.view.setUint8(0, index);
    this.view.setFloat32(1, value);
    if (this.ringbuf.available_write() < SIZE_ELEMENT) {
      return false;
    }
    return this.ringbuf.push(this.array) === SIZE_ELEMENT;
  }
}

/**
 * Receive parameter changes, lock free, no gc, between a UI thread (browser
 * main thread or worker) and a real-time thread (in an AudioWorkletProcessor).
 * Write and Reader cannot change role after setup, unless externally
 * synchronized.
 *
 * GC _can_ happen during the initial construction of this object when hopefully
 * no audio is being output. This depends on the implementation.
 *
 * Parameter changes are like in the VST framework: an index and a float value
 * (no restriction on the value).
 *
 * This class supports up to 256 parameters, but this is easy to extend if
 * needed.
 *
 * An element is an index, that is an unsigned byte, and a float32, which is 4
 * bytes.
 */
export class ParameterReader {
  /**
   * @constructor
   * @param {RingBuffer} ringbuf A RingBuffer setup to hold Uint8.
   */
  constructor(ringbuf) {
    const SIZE_ELEMENT = 5;
    this.ringbuf = ringbuf;
    this.mem = new ArrayBuffer(SIZE_ELEMENT);
    this.array = new Uint8Array(this.mem);
    this.view = new DataView(this.mem);
  }
  /**
   * Attempt to dequeue a single parameter change.
   * @param {Object} o An object with two attributes: `index` and `value`.
   * @return true if a parameter change has been dequeued, false otherwise.
   */
  dequeue_change(o) {
    if (this.ringbuf.empty()) {
      return false;
    }
    const rv = this.ringbuf.pop(this.array);
    o.index = this.view.getUint8(0);
    o.value = this.view.getFloat32(1);

    return rv === this.array.length;
  }
}
