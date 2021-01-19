# `ringbuf.js`

A thread-safe wait-free single-consumer single-producer ring buffer for the web,
and some utilities.

The main files of this library:

- `js/ringbuf.js`: base data structure, implementing the ring-buffer. This is
  intentionally heavily commented.
- `js/audioqueue.js`: wrapper for audio data streaming, without using
  `postMessage`.
- `js/param.js`: wrapper for parameter changes, allowing to send pairs of index
  and value without using `postMessage`.

This library contains an example, explained below, with the following files:

- `example/app.js`: example usage, main thread side (send audio and param
  changes to the real-time thread)
- `example/processor.js`: example usage, real-time thread side (receive audio
  and parameter changes from the main thread)
- `example/utils.js`: helper to load multiple files in an `AudioWorkletGlobalScope`
- `example/index.js`: vendored and built version of the library to have the
  example easily online.

## Demo and use-cases

<https://ringbuf-js.netlify.app/> is a deployment of the example in this repository
with a web server that answers with the right headers for this directory, and
allows the example to work. More details available at [Planned changes to shared memory
](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer/Planned_changes).

As of 2020-07-28, this example works in Chrome and Firefox.

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
- Implement infinite audio streams, Web radio stations.

## Run locally

> `cd example; node server.js`

This is a simple web server that sets the right headers to use
`SharedArrayBuffer` (see [Planned changes to shared memory
](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer/Planned_changes)
on MDN), and uses `https` (however this requires a bit of manual setup,
[mkcert](https://github.com/FiloSottile/mkcert) can be useful, read the source,
it's not particularly complicated).

## Contribute

Please do (just open an issue or send a PR).

> `npm run-script build`

allows running the build step and copying the file to allow the example to work.

## License

Mozilla Public License 2.0
