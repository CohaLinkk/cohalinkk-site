// Petit serveur HTTP qui expose la fonction de contact sur le VPS.
// Nginx sert les pages statiques et transmet uniquement /api/contact ici.
// Variables d'environnement : voir deploy/contact.env.example

import http from "node:http";
import handler from "../netlify/functions/contact.mjs";

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "127.0.0.1";
const MAX_BODY = 100 * 1024;

http
  .createServer(async (req, res) => {
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BODY) {
          res.writeHead(413).end("Payload too large");
          return;
        }
        chunks.push(chunk);
      }

      const hasBody = !["GET", "HEAD"].includes(req.method);
      const request = new Request(`http://localhost${req.url}`, {
        method: req.method,
        headers: { "content-type": req.headers["content-type"] || "" },
        body: hasBody ? Buffer.concat(chunks) : undefined,
      });

      const response = await handler(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (err) {
      console.error(err);
      res.writeHead(500).end("Internal error");
    }
  })
  .listen(PORT, HOST, () => {
    console.log(`Formulaire de contact en écoute sur http://${HOST}:${PORT}`);
  });
