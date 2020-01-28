// From a series of URL to js files, get an object URL that can be loaded in an
// AudioWorklet. This is useful to be able to use multiple files (utils, data
// structure, main DSP, etc.) without either using static imports, eval, manual
// concatenation with or without a build step, etc.
function URLFromFiles(files) {
  var promises = [];
  for (var file of files) {
    promises.push(fetch(file));
  }
  var final = "";
  var count = 0;
  return new Promise(function(resolve, reject) {
    Promise.all(promises).then((p) => {
      p.forEach((e)=> {
        e.text().then((t)=> {
          final+=t;
          count++;
          if (count == files.length) {
            var b = new Blob([final], {type: "application/javascript"});
            var url = URL.createObjectURL(b);
            resolve(url);
          }
        });
      });
    });
  });
}
