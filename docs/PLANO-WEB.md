# Plano — Interface Web com Chat Ancorado (shieldPy)

> Extensão do MVP: uma página onde qualquer pessoa fornece um ambiente
> (arrasta arquivos, cola código ou escolhe um exemplo), o **motor prova** as
> colisões, e ela **conversa com o shieldPy** sobre os achados — sempre preso
> aos fatos provados.

## Decisões travadas com o grupo
- **Entrada:** arrastar arquivos + colar código + exemplos prontos. (Postgres fica pra depois — precisa de banco ao vivo.)
- **Escopo do chat:** **ancorado nos fatos** — o chat só discute as colisões que o motor provou. Preserva a tese anti-alucinação.
- **Stack:** **vanilla + Node nativo** (HTML/JS puro + módulo `http`). Mantém a filosofia zero-dependência.

## Princípios (herdados do projeto)
- **Grounded:** o motor é o juiz; a IA é o intérprete. Fora dos fatos provados, o shieldPy esclarece/recusa — nunca inventa.
- **Chave segura:** `GEMINI_API_KEY` só no servidor, nunca no navegador.
- **Core intocado:** reaproveita `buildGraph`/`findCollisions`/`explain` sem alterar o motor.

## Arquitetura
```
web/
  public/
    index.html      # as duas zonas (ambiente + chat)
    app.js          # drag-drop, colar, exemplos, chamadas fetch, render
    style.css
  server.ts         # servidor http nativo: estáticos + /analyze + /chat
  session.ts        # Map em memória: sessionId -> { collisions, rules, history }
  scan-uploads.ts   # arquivos enviados -> escolhe parser p/ extensão -> Rule[]
src/agent/
  chat.ts           # modo conversa do Gemini (multi-turno, ancorado, texto livre)
  llm-gemini.ts     # ganha callGeminiChat() (reusa retry/backoff)
```

## Endpoints
**`POST /analyze`** — cria a sessão e prova as colisões
```
req:  { files: [{ name, content }] }   // OU  { example: "node"|"java"|"python"|"csharp" }
res:  { sessionId, report: DiagnosisReport, factsCount, skipped: string[] }
```

**`POST /chat`** — conversa ancorada nos fatos daquela sessão
```
req:  { sessionId, message }
res:  { reply, engine: "gemini"|"offline" }
```

## Como o chat fica ancorado (o detalhe crítico)
A cada `/chat`, o servidor monta pro Gemini:
- **`systemInstruction`** = PERSONA (guardrails) **+** a trava: *"só pode discutir as colisões PROVADAS abaixo; não afirme outras; se perguntarem fora da lista, diga que o motor não provou colisão ali."*
- **Fatos da sessão** (`Collision[]` + regras, em JSON) como contexto.
- **Histórico** da conversa (roles user/model) + a mensagem nova.

Assim o shieldPy responde livre em prosa, mas **não consegue inventar** um bug.

*Fallback:* sem chave/rede, o `/analyze` ainda entrega o report determinístico e o chat responde uma mensagem determinística resumindo os fatos — a demo nunca quebra.

## Faseamento
- **Fase A — MVP local (sem IA):** servidor + página + `scan-uploads` + `/analyze` mostrando os cartões; chat em modo offline. Roda em `localhost`.
- **Fase B — chat com Gemini:** `agent/chat.ts` + `/chat` multi-turno ancorado.
- **Fase C — publicar:** deploy num host grátis (Render/Fly/Heroku), chave via env do servidor, link pro grupo.

## Riscos/limitações
- Limite do free tier do Gemini em uso público → limitar requisições por sessão.
- Sessão em memória some se o servidor reinicia (ok pro MVP).
- Postgres fora do site (trabalho futuro).
- Limitar nº/tamanho de arquivos no `/analyze`.
