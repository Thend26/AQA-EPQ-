import http from "node:http";

const server = http.createServer((request, response) => {
  response.setHeader("Content-Type", "application/json");

  if (request.url === "/health") {
    response.writeHead(200);
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  if (request.url?.startsWith("/auth/v1/user")) {
    response.writeHead(401);
    response.end(JSON.stringify({ message: "No session" }));
    return;
  }

  response.writeHead(404);
  response.end(JSON.stringify({ message: "Not found" }));
});

server.listen(54321, "127.0.0.1");

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
