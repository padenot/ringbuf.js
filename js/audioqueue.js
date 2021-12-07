/**
 * Interleaved -> Planar audio buffer conversion
 *
 * This is useful to get data from a codec, the network, or anything that is
 * interleaved, into a planar format, for example a Web Audio API AudioBuffer or
 * the output parameter of an AudioWorkletProcessor.
 *
 * @param {Float32Array} input is an array of n*128 frames arrays, interleaved,
 * where n is the channel count.
 * @param {Float32Array} output is an array of 128-frames arrays.
 */
export function deinterleave(input, output) {
  const channel_count = input.length / 256;
  if (output.length !== channel_count) {
    throw RangeError("not enough space in output arrays");
  }
  for (let i = 0; i < channel_count; i++) {
    const out_channel = output[i];
    let interleaved_idx = i;
    for (let j = 0; j < 128; ++j) {
      out_channel[j] = input[interleaved_idx];
      interleaved_idx += channel_count;
    }
  }
}

/**
 * Planar -> Interleaved audio buffer conversion
 *
 * This function is useful to get data from the Web Audio API (that uses a
 * planar format), into something that a codec or network streaming library
 * would expect.
 *
 * @param {Float32Array} input An array of n*128 frames Float32Array that hold the audio data.
 * @param {Float32Array} output A Float32Array that is n*128 elements long.
 */
export function interleave(input, output) {
  if (input.length * 128 !== output.length) {
    throw RangeError("input and output of incompatible sizes");
  }
  let out_idx = 0;
  for (let i = 0; i < 128; i++) {
    for (let channel = 0; channel < input.length; channel++) {
      output[out_idx] = input[channel][i];
      out_idx++;
    }
  }
}

/**
 * Send interleaved audio frames to another thread, wait-free.
 *
 * These classes allow communicating between a non-real time thread (browser
 * main thread or worker) and a real-time thread (in an AudioWorkletProcessor).
 * Write and Reader cannot change role after setup, unless externally
 * synchronized.
 *
 * GC _can_ happen during the initial construction of this object when hopefully
 * no audio is being output. This depends on how implementations schedule GC
 * passes. After the setup phase no GC is triggered on either side of the queue.
 */
export class AudioWriter {
  /**
   * From a RingBuffer, build an object that can enqueue enqueue audio in a ring
   * buffer.
   * @constructor
   */
  constructor(ringbuf) {
    if (ringbuf.type() !== "Float32Array") {
      throw TypeError("This class requires a ring buffer of Float32Array");
    }
    this.ringbuf = ringbuf;
  }
  /**
   * Enqueue a buffer of interleaved audio into the ring buffer.
   *
   *
   * Care should be taken to enqueue a number of samples that is a multiple of the
   * channel count of the audio stream.
   *
   * @param {Float32Array} buf An array of interleaved audio frames.
   *
   * @return The number of samples that have been successfuly written to the
   * queue. `buf` is not written to during this call, so the samples that
   * haven't been written to the queue are still available.
   */
  enqueue(buf) {
    return this.ringbuf.push(buf);
  }

  /**
   * @return The free space in the ring buffer. This is the amount of samples
   * that can be queued, with a guarantee of success.
   */
  available_write() {
    return this.ringbuf.available_write();
  }
}

/**
 * Receive interleaved audio frames to another thread, wait-free.
 *
 * GC _can_ happen during the initial construction of this object when hopefully
 * no audio is being output. This depends on how implementations schedule GC
 * passes. After the setup phase no GC is triggered on either side of the queue.
 */
export class AudioReader {
  /**
   * From a RingBuffer, build an object that can dequeue audio in a ring
   * buffer.
   * @constructor
   */
  constructor(ringbuf) {
    if (ringbuf.type() !== "Float32Array") {
      throw TypeError("This class requires a ring buffer of Float32Array");
    }
    this.ringbuf = ringbuf;
  }
  /**
   * Attempt to dequeue at most `buf.length` samples from the queue. This
   * returns the number of samples dequeued. If greater than 0, the samples are
   * at the beginning of `buf`.
   *
   * Care should be taken to dequeue a number of samples that is a multiple of the
   * channel count of the audio stream.
   *
   * @param {Float32Array} buf A buffer in which to copy the dequeued
   * interleaved audio frames.
   * @return The number of samples dequeued.
   */
  dequeue(buf) {
    if (this.ringbuf.empty()) {
      return 0;
    }
    return this.ringbuf.pop(buf);
  }
  /**
   * Query the occupied space in the queue.
   *
   * @return The amount of samples that can be read with a guarantee of success.
   *
   */
  available_read() {
    return this.ringbuf.available_read();
  }
}
