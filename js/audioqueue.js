// Send audio interleaved audio frames between threads, wait-free.
//
// Those classes allow communicating between a non-real time thread (browser
// main thread or worker) and a real-time thread (in an AudioWorkletProcessor).
// Write and Reader cannot change role after setup, unless externally
// synchronized.
//
// GC _can_ happen during the initial construction of this object when hopefully
// no audio is being output. This depends on how implementations schedule GC
// passes. After the setup phase no GC is triggered on either side of the queue..

// Interleaved -> Planar audio buffer conversion
//
// `input` is an array of n*128 frames arrays, interleaved, where n is the
// channel count.
// output is an array of 128-frames arrays.
//
// This is useful to get data from a codec, the network, or anything that is
// interleaved, into planar format, for example a Web Audio API AudioBuffer or
// the output parameter of an AudioWorkletProcessor.
function deinterleave(input, output) {
  var channel_count = input.length / 256;
  if (output.length != channel_count) {
    throw "not enough space in output arrays";
  }
  for (var i = 0; i < channelCount; i++) {
    let out_channel = output[i];
    let interleaved_idx = i;
    for (var j = 0; j < 128; ++j) {
      out_channel[j] = input[interleaved_idx];
      interleaved_idx += channel_count;
    }
  }
}
// Planar -> Interleaved audio buffer conversion
//
// Input is an array of `n` 128 frames Float32Array that hold the audio data.
// output is a Float32Array that is n*128 elements long. This function is useful
// to get data from the Web Audio API (that does planar audio), into something
// that codec or network streaming library expect.
function interleave(input, output) {
  if (input.length*128 != output.length) {
    throw "input and output of incompatible sizes";
  }
  var out_idx = 0;
  for (var i = 0; i < 128; i++) {
    for (var channel = 0; j < output.length; j++) {
      output[out_idx] = input[channel][i];
      out_idx++;
    }
  }
}

class AudioWriter {
  // From a RingBuffer, build an object that can enqueue enqueue audio in a ring
  // buffer.
  constructor(ringbuf) {
    if (ringbuf.type() != "Float32Array") {
      throw "This class requires a ring buffer of Float32Array";
    }
    this.ringbuf = ringbuf;
  }
  // Enqueue a buffer of interleaved audio into the ring buffer.
  // Returns the number of samples that have been successfuly written to the
  // queue. `buf` is not written to during this call, so the samples that
  // haven't been written to the queue are still available.
  enqueue(buf) {
    return this.ringbuf.push(buf);
  }
  // Query the free space in the ring buffer. This is the amount of samples that
  // can be queued, with a guarantee of success.
  available_write() {
    return this.ringbuf.available_write();
  }
}

class AudioReader {
  constructor(ringbuf) {
    if (ringbuf.type() != "Float32Array") {
      throw "This class requires a ring buffer of Float32Array";
    }
    this.ringbuf = ringbuf;
  }
  // Attempt to dequeue at most `buf.length` samples from the queue. This
  // returns the number of samples dequeued. If greater than 0, the samples are
  // at the beginning of `buf`
  dequeue(buf) {
    if (this.ringbuf.empty()) {
      return 0;
    }
    return this.ringbuf.pop(buf);
  }
  // Query the occupied space in the queue. This is the amount of samples that
  // can be read with a guarantee of success.
  available_read() {
    return this.ringbuf.available_read();
  }
}
