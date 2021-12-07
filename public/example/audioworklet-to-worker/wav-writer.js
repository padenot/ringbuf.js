const exports = {};

// Read some float32 pcm from the queue, convert to int16 pcm, and push it to
// our global queue.
function readFromQueue() {
  const samples_read = this._audio_reader.dequeue(this.staging);
  if (!samples_read) {
    return 0;
  }
  const segment = new Int16Array(samples_read);
  for (let i = 0; i < samples_read; i++) {
    segment[i] = Math.min(Math.max(this.staging[i], -1.0), 1.0) * (2 << 14);
  }
  pcm.push(segment);
  return samples_read;
}

onmessage = function (e) {
  switch (e.data.command) {
    case "init": {
      this._audio_reader = new exports.AudioReader(
        new RingBuffer(e.data.sab, Float32Array)
      );
      // The number of channels of the audio stream read from the queue.
      this.channelCount = e.data.channelCount;
      // The sample-rate of the audio stream read from the queue.
      this.sampleRate = e.data.sampleRate;

      // Store the audio data, segment by segments, as array of int16 samples.
      this.pcm = [];
      // A smaller staging array to copy the audio samples from, before conversion
      // to uint16. It's size is 4 times less than the 1 second worth of data
      // that the ring buffer can hold, so it's 250ms, allowing to not make
      // deadlines:
      // staging buffer size = ring buffer size / sizeof(float32) / stereo / 4
      this.staging = new Float32Array(e.data.sab.byteLength / 4 / 4 / 2);
      // Attempt to dequeue every 100ms. Making this deadline isn't critical:
      // there's 1 second worth of space in the queue, and we'll be dequeing
      interval = setInterval(readFromQueue, 100);
      break;
    }
    case "stop": {
      clearInterval(interval);
      // Drain the ring buffer
      while (readFromQueue()) {
        /* empty */
      }
      // Structure of a wav file, with a byte offset for the values to modify:
      // sample-rate, channel count, block align.
      const CHANNEL_OFFSET = 22;
      const SAMPLE_RATE_OFFSET = 24;
      const BLOCK_ALIGN_OFFSET = 32;
      const header = [
        // RIFF header
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
        // fmt chunk. We always write 16-bit samples.
        0x66, 0x6d, 0x74, 0x20, 0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0xff, 0xff,
        0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0x10, 0x00,
        // data chunk
        0x64, 0x61, 0x74, 0x61, 0xfe, 0xff, 0xff, 0x7f,
      ];
      // Find final size: size of the header + number of samples * channel count
      // * 2 because pcm16
      let size = header.length;
      for (let i = 0; i < this.pcm.length; i++) {
        size += this.pcm[i].length * 2;
      }
      const wav = new Uint8Array(size);
      const view = new DataView(wav.buffer);

      // Copy the header, and modify the values: note that RIFF
      // is little-endian, we need to pass `true` as the last param.
      for (let i = 0; i < wav.length; i++) {
        wav[i] = header[i];
      }

      console.log(
        `Writing wav file: ${this.sampleRate}Hz, ${this.channelCount} channels, int16`
      );

      view.setUint16(CHANNEL_OFFSET, this.channelCount, true);
      view.setUint32(SAMPLE_RATE_OFFSET, this.sampleRate, true);
      view.setUint16(BLOCK_ALIGN_OFFSET, this.channelCount * 2, true);

      // Finally, copy each segment in order as int16, and transfer the array
      // back to the main thread for download.
      let writeIndex = header.length;
      for (let segment = 0; segment < this.pcm.length; segment++) {
        for (let sample = 0; sample < this.pcm[segment].length; sample++) {
          view.setInt16(writeIndex, this.pcm[segment][sample], true);
          writeIndex += 2;
        }
      }
      postMessage(wav.buffer, [wav.buffer]);
      break;
    }
    default: {
      throw Error("Case not handled");
    }
  }
};
