import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { saveRegistration, sendApiError } from "./lib/registration.js";

const app = express();
const port = Number(process.env.PORT) || 4174;
const rootDirectory = path.dirname(fileURLToPath(import.meta.url));

function sendFreshFile(response, filename, contentType) {
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
  response.type(contentType);
  response.sendFile(path.join(rootDirectory, filename));
}

app.get("/", (_request, response) => sendFreshFile(response, "index.html", "html"));
app.get("/app.js", (_request, response) => sendFreshFile(response, "app.js", "js"));
app.get("/styles.css", (_request, response) => sendFreshFile(response, "styles.css", "css"));
app.use("/assets", express.static(path.join(rootDirectory, "assets")));

app.post("/api/registrations", express.json(), saveRegistration);
app.use((error, _request, response, _next) => sendApiError(error, response));

app.listen(port, () => {
  console.log(`Hackfluence registration running at http://127.0.0.1:${port}`);
});
