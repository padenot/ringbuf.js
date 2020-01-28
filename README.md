# `ringbuf.js`

A thread-safe wait-free single-consumer single-producer ring buffer for the web,
and some utilities.

- `js/app.js`: example usage, main thread side (send audio and param changes to
  the real-time thread)
- `js/processor.js`: example usage, real-time thread side (receive audio and
  parameter changes from the main thread)
- `js/ringbuf.js`: base data structure
- `js/audioqueue.js`: wrapper for audio data streaming
- `js/param.js`: wrapper for parameter changes
- `js/utils.js`: helper to load multiple files in an `AudioWorkletGlobalScope`

## Demo and use-cases

<https://padenot.github.io/ringbuf.js>

A sine wave is generated on the main thread, sent to the audio thread, played
out. The frequency of this sine wave is controllable from the main thread. The
amplitude of this sine wave is also controllable: the amplitude parameter is
communicated lock-free to the real-time thread.

Yes this is a contrived example, people should not use the main thread or any
other non-real-time thread this if they can. However sending audio from a
non-real-time thread to a real-time thread is sometimes useful:

- Decoding a audio codecs that browsers don't support natively in a web worker,
  sending the PCM to an `AudioWorklet` (no need to fiddle with
  `AudioBufferSourceNode`, etc.)
- Implementing emulators for (e.g.) old consoles that only had one execution
  thread and did everything on the same CPU
- Porting code that is using a push-style audio API (`SDL_QueueAudio`) without
  having to refactor everything.

The opposite (recording the input of an `AudioWorklet`) is very useful:

- Implement off-main-thread off-real-time-thread audio analysis (streaming the
  real-time audio data to a web worker, visualizing it using an
  `OffscreenCanvas`, shielding the audio processing and visualization from main
  thread load)
- Implement off-main-thread off-real-time thread encoding of audio data in a
  codec not supported by `MediaRecorder`, or maybe with more flexibility.

## Run locally

`node server.js`

This is a simple web server that set the right headers to use
`SharedArrayBuffer` (see [Planned changes to shared memory
](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer/Planned_changes)
on MDN), and uses `https` (however this requires a bit of manual setup,
[mkcert](https://github.com/FiloSottile/mkcert) can be useful).

## Contribute

Please do (just open an issue or send a PR).

## Authors

Paul Adenot, Mozilla

## License

Mozilla Public License 2.0
