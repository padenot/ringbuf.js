const $ = document.querySelectorAll.bind(document);

const ctx = new AudioContext();
var frequency = 440,
    phase = 0.0,
    sine = new Float32Array(128);

URLFromFiles(['processor.js', 'index.js']).then((e) => {
    if (ctx.audioWorklet === undefined) {
      alert("no audioworklet");
    } else {
      ctx.audioWorklet.addModule(e).then(() => {
        const n = new AudioWorkletNode(ctx, "processor", [1]);
        n.connect(ctx.destination);

        // 50ms of buffer, increase in case of glitches
        let sab = exports.RingBuffer.getStorageForCapacity(ctx.sampleRate / 20, Float32Array);
        let rb = new exports.RingBuffer(sab, Float32Array);
        audioWriter = new exports.AudioWriter(rb);
        n.port.postMessage({
          type: "recv-audio-queue",
          data: sab,
        });

        let sab2 = exports.RingBuffer.getStorageForCapacity(31, Uint8Array);
        let rb2 = new exports.RingBuffer(sab2, Uint8Array);
        paramWriter = new ParameterWriter(rb2);
        n.port.postMessage({
          type: "recv-param-queue",
          data: sab2
        });

        const freq = $(".freq")[0];
        const label = $(".freqLabel")[0];

        freq.addEventListener("input", e => {
          label.innerText = e.target.value;
          window.frequency = e.target.value;
        });
        const amp = $(".amp")[0];
        const ampLabel = $(".ampLabel")[0];

        amp.addEventListener("input", e => {
          ampLabel.innerText = e.target.value;
          paramWriter.enqueue_change(0, e.target.value);
        });
      });
    }
  });

function render() {
  requestAnimationFrame(render);
  if (!window.audioWriter) {
    return;
  }
  // Synthetize a simple sine wave so it's easy to hear glitches, continuously
  // if there is room in the ring buffer.
  while (window.audioWriter.available_write() > 128) {
    for (var i = 0; i < 128; i++) {
      sine[i] = Math.sin(phase);
      phase += (2 * Math.PI * window.frequency) / ctx.sampleRate;
      if (phase > 2 * Math.PI) {
        phase -= 2 * Math.PI;
      }
    }
    window.audioWriter.enqueue(sine);
  }
}
requestAnimationFrame(render);

var start = $(".start")[0];
start.onclick = function () {
  if (ctx.state == "running") {
    ctx.suspend();
    start.innerText = "Start";
  } else {
    ctx.resume();
    start.innerText = "Stop";
  }
};
