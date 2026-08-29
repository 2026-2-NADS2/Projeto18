// Frontend do shieldPy web. Zero dependência: só fetch + DOM.
// A chave do Gemini vive no servidor; aqui só mandamos arquivos/mensagens.

const $ = (sel) => document.querySelector(sel);

let collectedFiles = []; // [{ name, content }]
let selectedExample = null;
let sessionId = null;

const LANG_EXT = { ts: "ts", java: "java", py: "py", cs: "cs" };
const SEV_ICON = { "Crítico": "🔴", "Alto": "🟠", "Médio": "🟡", "Baixo": "🟢" };

// ---------- entrada: exemplos ----------
document.querySelectorAll("button.ex").forEach((btn) => {
  btn.addEventListener("click", () => {
    const active = btn.classList.contains("active");
    document.querySelectorAll("button.ex").forEach((b) => b.classList.remove("active"));
    selectedExample = active ? null : btn.dataset.ex;
    if (!active) btn.classList.add("active");
    setMsg(selectedExample ? `Exemplo selecionado: ${btn.textContent}` : "");
  });
});

// ---------- entrada: arrastar / escolher arquivos ----------
const drop = $("#drop");
const fileInput = $("#file-input");
$("#pick").addEventListener("click", (e) => { e.preventDefault(); fileInput.click(); });
fileInput.addEventListener("change", () => addFiles(fileInput.files));

["dragenter", "dragover"].forEach((ev) =>
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) =>
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));

async function addFiles(fileList) {
  for (const file of fileList) {
    const content = await file.text();
    collectedFiles.push({ name: file.name, content });
  }
  renderFileList();
}

function renderFileList() {
  const ul = $("#file-list");
  ul.innerHTML = "";
  collectedFiles.forEach((f, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${escapeHtml(f.name)}</span>`;
    const rm = document.createElement("button");
    rm.textContent = "✕";
    rm.title = "remover";
    rm.addEventListener("click", () => { collectedFiles.splice(i, 1); renderFileList(); });
    li.appendChild(rm);
    ul.appendChild(li);
  });
}

// ---------- analisar ----------
$("#analyze").addEventListener("click", analyze);

async function analyze() {
  const paste = $("#paste").value.trim();
  const files = [...collectedFiles];
  if (paste) {
    const ext = LANG_EXT[$("#lang").value] || "ts";
    files.push({ name: `colado.${ext}`, content: paste });
  }

  let payload;
  if (selectedExample) payload = { example: selectedExample };
  else if (files.length > 0) payload = { files };
  else return setMsg("Escolha um exemplo, cole código ou arraste ao menos um arquivo.");

  setBusy(true);
  setMsg("Analisando com o motor...");
  try {
    const res = await fetch("/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "falha na análise");
    sessionId = data.sessionId;
    renderReport(data);
    setMsg(data.skipped?.length ? `Ignorados (extensão não suportada): ${data.skipped.join(", ")}` : "");
  } catch (err) {
    setMsg("Erro: " + err.message);
  } finally {
    setBusy(false);
  }
}

function renderReport(data) {
  const report = data.report;
  $("#summary").classList.remove("muted");
  $("#summary").textContent = report.summary;

  const origem = report.engine === "gemini" ? "IA (Gemini)" : "explicador offline (determinístico)";
  const cards = $("#cards");
  cards.innerHTML = `<p class="engine-tag">origem do texto: ${origem} · ${data.factsCount} colisão(ões)</p>`;

  report.diagnoses.forEach((d) => {
    const el = document.createElement("div");
    el.className = `card sev-${d.severity}`;
    el.innerHTML = `
      <div class="head">
        <span>${SEV_ICON[d.severity] || ""}</span>
        <span class="pill">Status: ${escapeHtml(d.status)}</span>
        <span class="pill">Severidade: ${escapeHtml(d.severity)}</span>
        <span class="pill">Confiança: ${d.confidence}%</span>
      </div>
      <div class="row"><b>Chave/Namespace Afetado:</b> ${escapeHtml(d.affectedKey)}</div>
      <div class="row"><b>Origens em Conflito:</b> ${escapeHtml(d.conflictingSources)}</div>
      <div class="row"><b>Causa Raiz:</b> ${escapeHtml(d.rootCause)}</div>
      <div class="row"><b>Recomendação Declarativa:</b> ${escapeHtml(d.recommendation)}</div>`;
    cards.appendChild(el);
  });

  // abre o chat e o semeia
  $("#chat-wrap").classList.remove("hidden");
  $("#chat").innerHTML = "";
  const intro = data.factsCount > 0
    ? `Analisei o sistema e o motor provou ${data.factsCount} colisão(ões). Pergunte o que quiser sobre os achados.`
    : "Analisei o sistema e o motor não provou nenhuma colisão nos eventos avaliados.";
  addBubble("bot", intro);
}

// ---------- chat ----------
$("#chat-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = $("#chat-input");
  const message = input.value.trim();
  if (!message || !sessionId) return;
  addBubble("user", message);
  input.value = "";
  const pending = addBubble("bot", "");
  pending.querySelector(".text").innerHTML =
    '<span class="typing"><span></span><span></span><span></span></span>';
  chatBusy(true);
  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, message }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "falha no chat");
    pending.querySelector(".text").textContent = data.reply;
  } catch (err) {
    pending.querySelector(".text").textContent = "Erro: " + err.message;
  } finally {
    chatBusy(false);
  }
});

function addBubble(who, text) {
  const el = document.createElement("div");
  el.className = `bubble ${who}`;
  if (who === "bot") {
    el.innerHTML = `<span class="who">🛡️ shieldPy</span><span class="text"></span>`;
    el.querySelector(".text").textContent = text;
  } else {
    el.textContent = text;
  }
  const chat = $("#chat");
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
  return el;
}

// ---------- utils ----------
function setBusy(b) { $("#analyze").disabled = b; }
function chatBusy(b) { $("#chat-form").querySelector("button").disabled = b; }
function setMsg(m) { $("#analyze-msg").textContent = m; }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
