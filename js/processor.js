class Processor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [];
  }

  constructor() {
    super();
    this.interleaved = new Float32Array(128);
    this.amp = 1.0;
    this.o = { index: 0, value: 0 };
    this.port.onmessage = e => {
      this._size = 128;
      if (e.data.type === "recv-audio-queue") {
        this._audio_reader = new AudioReader(new RingBuffer(e.data.data, Float32Array));
      } else if (e.data.type === "recv-param-queue") {
        this._param_reader = new ParameterReader(new RingBuffer(e.data.data, Uint8Array));
      } else {
        throw "unexpected.";
      }
    };
  }

  process(inputs, outputs, parameters) {
    // Get any param changes
    let index, value;
    if (this._param_reader.dequeue_change(this.o)) {
      console.log("param change: ", this.o.index, this.o.value);
      this.amp = this.o.value;
    }

    // read 128 frames from the queue, deinterleave, and write to output
    // buffers.
    this._audio_reader.dequeue(this.interleaved);

    for (var i = 0; i < 128; i++) {
      outputs[0][0][i] = this.amp * this.interleaved[i]
    }

    return true;
  }
}

registerProcessor("processor", Processor);
