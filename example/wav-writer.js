let exports = {};

function readFromQueue() {
  // read some float32 pcm, convert to to int16 pcm;
  var samples_read = this._audio_reader.dequeue(this.staging);
  if (!samples_read) {
    return 0;
  }
  var segment = new Int16Array(samples_read);
  for (var i = 0; i < samples_read; i++) {
    segment[i] = Math.min(Math.max(this.staging[i], -1.0), 1.0) * (2 << 14);
  }
  this.pcm.push(segment);
}

onmessage = function(e) {
  switch(e.data.command) {
    case "init" : {
      this._audio_reader = new exports.AudioReader(new RingBuffer(e.data.sab, Float32Array));
      this.channelCount = e.data.channelCount;
      this.sampleRate = e.data.sampleRate;

      this.pcm = [];
      // A smaller staging array to copy the audio samples from, before conversion
      // to uint16.
      this.staging = new Float32Array(e.data.sab.byteLength / 4 / 4 / 2);
      interval = setInterval(readFromQueue, 100); // attempt to dequeue every 100ms
    }
      break;
    case "stop" : {
      clearInterval(interval);
      // Drain the ring buffer
      while (readFromQueue()) { }
      // Structure of a wav file, with a byte offset for the values to modify:
      // sample-rate, channel count, block align.
      const CHANNEL_OFFSET = 22;
      const SAMPLE_RATE_OFFSET = 24;
      const BLOCK_ALIGN_OFFSET = 32;
      var header = [
        // RIFF header
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
        // fmt chunk. We always write 16-bit samples.
        0x66, 0x6d, 0x74, 0x20, 0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0xFF, 0xFF,
        0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x10, 0x00,
        // data chunk
        0x64, 0x61, 0x74, 0x61, 0xFE, 0xFF, 0xFF, 0x7F];
      // Find final size: size of the header + number of samples * channel count
      // * 2 because pcm16
      var size = header.length;
      for (var i = 0; i < this.pcm.length; i++) {
        size += this.pcm[i].length * 2;
      }
      let wav = new Uint8Array(size);
      let view = new DataView(wav.buffer);

      // Copy the header, and modify the values: note that RIFF 
      // is little-endian, we need to pass `true` as the last param.
      for (var i = 0 ; i < wav.length; i++) {
        wav[i] = header[i];
      }

      console.log(`Writing wav file: ${this.sampleRate}Hz, ${this.channelCount} channels, int16`);

      view.setUint16(CHANNEL_OFFSET, this.channelCount, true);
      view.setUint32(SAMPLE_RATE_OFFSET, this.sampleRate, true);
      view.setUint16(BLOCK_ALIGN_OFFSET, this.channelCount * 2, true);

      // Finally, copy each segment in order as int16, and transfer the array
      // back to the main thread for download.
      var writeIndex = header.length;
      for (var segment = 0; segment < this.pcm.length; segment++) {
        for (var sample = 0; sample < this.pcm[segment].length; sample++) {
          view.setInt16(writeIndex, this.pcm[segment][sample], true);
          writeIndex+=2;
        }
      }
      postMessage(wav.buffer, [wav.buffer]);
    }
  }
}

