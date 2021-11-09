var exports = {};

class RecorderWorklet extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [];
  }

  constructor(options) {
    super();
    this.interleaved = new Float32Array(128 * 2); // stereo
    var sab = options.processorOptions;
    this._audio_writer = new AudioWriter(new RingBuffer(sab, Float32Array));
    console.log(this._audio_writer);
  }

  process(inputs, outputs, parameters) {
    // interleave and store in the queue
    if (inputs[0]) {
      interleave(inputs[0], this.interleaved);
      if (this._audio_writer.enqueue(this.interleaved) != 256) {
        console.log("underrun: the worker doesn't dequeue fast enough!");
      }
    }

    return true;
  }
}

registerProcessor("recorder-worklet", RecorderWorklet);
