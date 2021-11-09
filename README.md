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

## Examples and use-cases

<https://ringbuf-js.netlify.app/> is a deployment of the examples in this
repository with a web server that answers with the right headers for this
directory, and allows the example to work. More details available at [Planned
changes to shared memory
](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer/Planned_changes).

Those examples work in browsers that support both the `AudioWorklet`, and
`SharedArrayBuffer`.

While most real-time audio work should happen on a real-time thread (which means
inside the `AudioWorkletGlobaleScope` on the Web), sending (resp. receiving) audio
to (from) a non-real-time thread is useful:

- Decoding a audio codecs that browsers don't support natively in a web worker,
  sending the PCM to an `AudioWorklet` (no need to fiddle with
  `AudioBufferSourceNode`, etc.)
- Conversely, recording the output of an `AudioContext` using an
  `AudioWorkletNode` with a very high degree of reliability and extreme
  flexibility, possibly using Web Codecs or a WASM based solution for the
  encoding, and then sending the result to the network or storing it locally.
- Implementing emulators for (e.g.) old consoles that only had one execution
  thread and did everything on the same CPU
- Porting code that is using a push-style audio API (`SDL_QueueAudio`) without
  having to refactor everything.
- Implement off-main-thread off-real-time-thread audio analysis (streaming the
  real-time audio data to a web worker, visualizing it using an
  `OffscreenCanvas`, shielding the audio processing and visualization from main
  thread load)

## Run locally

> `cd public; node ../server.js`

This is a simple web server that sets the right headers to use
`SharedArrayBuffer` (see [Planned changes to shared memory
](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer/Planned_changes)
on MDN).

## Contribute

Please do (just open an issue or send a PR).

> make build

allows running the build step and copying the file to allow the example to work.

> make doc

allows rebuilding the documentation.

## Compatibility

This needs the `SharedArrayBuffer`, so a couple of HTTP headers might need to be
set on the web server serving the page.

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

As of 2021-11-09, the following browsers are compatible:

- Firefox Desktop all current versions including current ESR
- Firefox for Android all current versions
- Chrome Desktop and (usually) Chromium-based browsers (for a long time)
- Chrome for Android version 88 and later and browsers based on Chrome version
    88 and later
- Safari run in the following way:
    `__XPC_JSC_useSharedArrayBuffer=1 open -a "Safari"`
- Safari Tech Preview's current version

## License

Mozilla Public License 2.0
