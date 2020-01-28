const https = require('https'),
    url = require("url"),
    path = require("path"),
    fs = require("fs"),
    port = process.argv[2] || 8888,
    mimeTypes = {
      "html": "text/html",
      "jpeg": "image/jpeg",
      "jpg": "image/jpeg",
      "png": "image/png",
      "js": "text/javascript",
      "wasm": "application/wasm",
      "css": "text/css"
    };

const options = {
  key: fs.readFileSync('example.com+5-key.pem'),
  cert: fs.readFileSync('example.com+5.pem')
};

https.createServer(options, function(request, response) {

  var uri = url.parse(request.url).pathname,
    filename = path.join(process.cwd(), uri);

  fs.exists(filename, function(exists) {
    if(!exists) {
      response.writeHead(404, { "Content-Type": "text/plain" });
      response.write("404 Not Found\n");
      response.end();
      return;
    }

    if (fs.statSync(filename).isDirectory())
      filename += '/index.html';

    fs.readFile(filename, "binary", function(err, file) {
      if(err) {
        response.writeHead(500, {"Content-Type": "text/plain", "Cross-Origin-Opener-Policy": "same-origin unsafe-allow-outgoing"});
        response.write(err + "\n");
        response.end();
        return;
      }

      var mimeType = mimeTypes[filename.split('.').pop()];

      if (!mimeType) {
        mimeType = 'text/plain';
      }

      response.writeHead(200, { "Content-Type": mimeType ,
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp" });
      response.write(file, "binary");
      response.end();
    });
  });
}).listen(parseInt(port, 10));

console.log("Static file server running at\n  => https://localhost:" + port + "/\nCTRL + C to shutdown");
