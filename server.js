import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { saveRegistration, sendApiError } from "./lib/registration.js";

const app = express();
const port = Number(process.env.PORT) || 4174;
const rootDirectory = path.dirname(fileURLToPath(import.meta.url));

app.get("/", (_request, response) => response.sendFile(path.join(rootDirectory, "index.html")));
app.get("/app.js", (_request, response) => response.sendFile(path.join(rootDirectory, "app.js")));
app.get("/styles.css", (_request, response) => response.sendFile(path.join(rootDirectory, "styles.css")));
app.use("/assets", express.static(path.join(rootDirectory, "assets")));

app.post("/api/registrations", express.json(), saveRegistration);
app.use((error, _request, response, _next) => sendApiError(error, response));

app.listen(port, () => {
  console.log(`Hackfluence registration running at http://127.0.0.1:${port}`);
});
