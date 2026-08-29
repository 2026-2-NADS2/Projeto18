// Servidor web do Grafo de Interações — módulo `http` nativo, zero dependência.
// Serve a página estática e expõe /analyze (roda o motor) e /chat (conversa
// ancorada com o shieldPy). A chave do Gemini fica SÓ aqui, nunca no navegador.
//
// Rodar: npm run web   (lê .env se existir; sem chave, usa o modo offline)

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import { buildGraph, findCollisions } from "../src/core/index.ts";
import { explain } from "../src/agent/index.ts";
import { chatReply } from "../src/agent/chat.ts";
import { rulesFromUploads, type UploadFile } from "./scan-uploads.ts";
import { loadSource } from "../src/cli/sources.ts";
import { createSession, getSession, appendTurn } from "./session.ts";

const PUBLIC = fileURLToPath(new URL("./public", import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const MAX_BODY = 5_000_000; // 5 MB

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(data);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error("payload muito grande"));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

/** Serve um arquivo estático de web/public (com proteção contra path traversal). */
async function serveStatic(res: ServerResponse, urlPath: string): Promise<void> {
  const rel = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = normalize(join(PUBLIC, rel));
  if (!filePath.startsWith(PUBLIC)) {
    res.writeHead(403).end("proibido");
    return;
  }
  try {
    const buf = await readFile(filePath);
    res.writeHead(200, { "content-type": MIME[extname(filePath)] ?? "application/octet-stream" });
    res.end(buf);
  } catch {
    res.writeHead(404).end("não encontrado");
  }
}

interface AnalyzeBody {
  files?: UploadFile[];
  example?: string;
}

/** POST /analyze — prova as colisões e abre a sessão de conversa. */
async function handleAnalyze(res: ServerResponse, raw: string): Promise<void> {
  const body = JSON.parse(raw) as AnalyzeBody;

  let rules;
  let skipped: string[] = [];
  let label: string;

  if (body.example) {
    const loaded = await loadSource(body.example);
    rules = loaded.rules;
    label = loaded.label;
  } else if (Array.isArray(body.files) && body.files.length > 0) {
    const result = rulesFromUploads(body.files);
    rules = result.rules;
    skipped = result.skipped;
    label = `${result.parsed} arquivo(s) analisado(s)`;
  } else {
    sendJson(res, 400, { error: "envie 'files' (arquivos) ou 'example' (um exemplo pronto)" });
    return;
  }

  const collisions = findCollisions(buildGraph(rules));
  const report = await explain(collisions, rules);
  const sessionId = createSession(collisions, rules);

  sendJson(res, 200, { sessionId, report, factsCount: collisions.length, label, skipped });
}

interface ChatBody {
  sessionId?: string;
  message?: string;
}

/** POST /chat — responde ancorado nos fatos da sessão. */
async function handleChat(res: ServerResponse, raw: string): Promise<void> {
  const body = JSON.parse(raw) as ChatBody;
  if (!body.sessionId || typeof body.message !== "string" || !body.message.trim()) {
    sendJson(res, 400, { error: "envie 'sessionId' e 'message'" });
    return;
  }
  const session = getSession(body.sessionId);
  if (!session) {
    sendJson(res, 404, { error: "sessão não encontrada — analise um sistema primeiro" });
    return;
  }

  const { reply, engine } = await chatReply(
    { collisions: session.collisions, rules: session.rules },
    session.history,
    body.message,
  );
  appendTurn(body.sessionId, "user", body.message);
  appendTurn(body.sessionId, "model", reply);

  sendJson(res, 200, { reply, engine });
}

const server = createServer(async (req, res) => {
  try {
    const url = (req.url ?? "/").split("?")[0];

    if (req.method === "POST" && url === "/analyze") {
      await handleAnalyze(res, await readBody(req));
      return;
    }
    if (req.method === "POST" && url === "/chat") {
      await handleChat(res, await readBody(req));
      return;
    }
    if (req.method === "GET") {
      await serveStatic(res, url);
      return;
    }
    res.writeHead(405).end("método não permitido");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("erro na requisição:", msg);
    if (!res.headersSent) sendJson(res, 500, { error: msg });
    else res.end();
  }
});

server.listen(PORT, () => {
  const modo = process.env.GEMINI_API_KEY ? "IA (Gemini) ligada" : "modo offline (sem GEMINI_API_KEY)";
  console.log(`🛡️  shieldPy web no ar: http://localhost:${PORT}  —  ${modo}`);
});
