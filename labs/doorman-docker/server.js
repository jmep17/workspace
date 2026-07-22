// Stand-in for a running branch: says who it is and echoes every header it
// received, so you can see the proxy's X-Forwarded-* annotations.
const http = require("http");
const name = process.env.BRANCH_NAME || "unnamed branch";
const port = Number(process.env.PORT) || 3101;

http
  .createServer((req, res) => {
    res.setHeader("content-type", "text/plain");
    res.end(
      name.toUpperCase() +
        " (port " + port + ")\n\n" +
        JSON.stringify(req.headers, null, 2) +
        "\n"
    );
  })
  .listen(port, () => console.log(name + " up on " + port));
