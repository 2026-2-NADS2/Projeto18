# Grafo de Interações — Status do Projeto (para o grupo)

> **O bug que ninguém escreveu.** Ferramenta que detecta quando duas regras
> reativas, cada uma correta sozinha, **colidem** por escrever/ler o mesmo campo
> no mesmo recurso+evento — o defeito que só aparece no conjunto (DEV✓/QA✓/PRD✗).

**Repositório:** https://github.com/2026-2-NADS2/Projeto18
**Status atual:** Fase 1 ✅ e Fase 2 ✅ concluídas. MVP completo, ponta a ponta.
**Testes:** 50/50 verdes. **Dependências:** só `pg` (o resto é Node puro).

---

## 1. A ideia em uma frase

O problema não está na peça, está no **conjunto**. Cada regra (um trigger, um
listener, um handler) passa nos testes isolada; o bug nasce quando duas reagem ao
**mesmo evento** e mexem no **mesmo campo**. Nossa ferramenta monta um *grafo de
interações* e **prova** matematicamente onde essas brigas existem — independente da
tecnologia usada.

Tipos de colisão detectados:
- **write-write** — duas regras escrevem o mesmo campo; o valor final depende de
  quem gravar por último (sobrescrita silenciosa).
- **read-after-write** — uma regra lê um campo que outra escreve. Classificamos a
  ordem em `reader-first` (lê valor velho — o bug clássico), `writer-first` (ok hoje,
  frágil) ou `unknown` (imprevisível — o pior caso em sistemas distribuídos).

---

## 2. Arquitetura (3 camadas + camada de IA)

Regra de ouro: **dependência de mão única**. O motor nunca conhece quem o usa.

```
src/
  core/       # O MOTOR — puro, zero I/O, zero IA. Prova as colisões.
  adapters/   # Os TRADUTORES — leem um sistema real e o convertem pro modelo do core.
  cli/        # Os COMANDOS de linha (report:* e explain).
  agent/      # A CAMADA DE IA (Fase 2) — explica as colisões. Importa do core; o core NUNCA importa daqui.
```

- **`core/` nunca importa de `adapters/` nem de `agent/`.** É isso que torna a ferramenta
  agnóstica e confiável.
- **A IA nunca "descobre" bugs.** Ela só traduz em linguagem humana as colisões que o
  motor determinístico já provou. **O motor é o juiz; a IA é o intérprete.**

---

## 3. Fase 1 — o motor determinístico ✅

O núcleo (`src/core/`) monta o grafo e roda o detector. Provamos que ele é
**agnóstico de domínio** construindo **5 adaptadores** para tecnologias bem diferentes,
todos chegando exatamente às mesmas 3 colisões plantadas (1 write-write + 2 read-after-write):

| Adaptador | Tecnologia | Como lê as regras | Semântica de ordem |
|-----------|-----------|-------------------|--------------------|
| `postgres/` | PostgreSQL (triggers reais) | catálogo `pg_trigger` + corpo PL/pgSQL | ordem alfabética do trigger → `reader-first` |
| `node-events/` | Microsserviços Node (event bus) | `bus.on('evento', ...)` | sem ordem garantida → `unknown` |
| `java-spring/` | Java / Spring | `@EventListener` + getters/setters | `unknown` |
| `python-django/` | Python / Django | `@receiver(signal, sender=...)` | `unknown` |
| `dotnet-mediatr/` | .NET / MediatR | `INotificationHandler<T>` | `unknown` |

> **Por que isso importa:** o mesmo defeito conceitual foi encontrado em banco de dados,
> microsserviços e três linguagens de backend. Prova a tese central do TCC.

O adaptador Postgres roda contra um **banco real** (Postgres.app local): ele lê os
triggers de verdade do catálogo do banco e aponta as brigas.

---

## 4. Fase 2 — a camada de IA (agente **shieldPy**) ✅

Pluga um LLM **em cima** dos fatos provados pelo motor, para explicar cada colisão em
linguagem natural. Classificação acadêmica: **camada neuro-simbólica de explicabilidade**
(o motor = raciocínio simbólico; o LLM = geração ancorada nos fatos).

**Persona: shieldPy — Especialista Sênior em DevOps**, operando sob *guardrails*:
- **Entrada:** mascara tokens/chaves/senhas/PII com `***`; trata metadados como *dados*
  (ignora instruções embutidas → anti *prompt-injection*).
- **Escopo read-only:** analisador declarativo; **nunca** sugere comando destrutivo
  (`kubectl delete`, `rm -rf`, `git push --force`); recusa tarefas fora de escopo.
- **Saída obrigatória (estrutura declarativa):** Status · Severidade · Mapeamento do
  Conflito (Chave/Namespace, Origens em Conflito, Causa Raiz) · Recomendação Declarativa.
- **Governança (human-in-the-loop):** confiança < 85% → Status forçado a
  **"Requer Revisão Humana"**.

**Dois modos de execução:**
1. **Com IA (Google Gemini):** free tier, chamado via `fetch` nativo (zero dependência).
2. **Fallback offline determinístico:** se não há chave/internet, cai num explicador por
   template (confiança 100%). *A demo nunca falha* (graceful degradation).

**Rastreabilidade:** todo diagnóstico carrega a `collision` original que o motor provou —
a IA não pode forjar um bug.

---

## 5. Como rodar (qualquer um do grupo)

Pré-requisito: **Node.js ≥ 22.6** (roda TypeScript nativamente, sem build).

```bash
git clone https://github.com/2026-2-NADS2/Projeto18.git
cd Projeto18
npm install        # instala só o pg

# rodar todos os testes (50/50)
npm test

# RELATÓRIO do motor (Fase 1) — aponta as colisões, sem IA:
npm run report:node        # microsserviços de exemplo
npm run report:java        # (ou python | csharp)
npm run report -- fixtures/postgres-example.json   # fixture manual

# DIAGNÓSTICO com o agente shieldPy (Fase 2):
npm run explain -- node    # (java | python | csharp | pg | fixture <arquivo>)
```

**Para usar o Gemini (opcional):** copie `.env.example` para `.env`, preencha
`GEMINI_API_KEY` (crie de graça em https://aistudio.google.com/apikey) e rode o
`explain`. Sem a chave, ele usa o modo offline automaticamente.

> ⚠️ **Nunca comite o `.env`** — ele está no `.gitignore`. A chave é pessoal e fica só
> na sua máquina. O que vai versionado é o `.env.example` (template vazio).

---

## 6. O que já está pronto vs. o que falta

**Pronto (escopo do MVP):**
- ✅ Motor determinístico agnóstico (Fase 1) — 5 adaptadores, validado em banco real
- ✅ Camada de IA com persona, guardrails e governança (Fase 2) — Gemini + fallback
- ✅ 50/50 testes automatizados
- ✅ README + este documento de status
- ✅ Publicado no GitHub da disciplina

**Próximo passo (o que resta do escopo):**
- ⏳ **Escrita do TCC** — documentar a arquitetura e a fundamentação (neuro-simbólico /
  XAI / human-in-the-loop). É redação, não código.

**Trabalhos futuros (opcionais, fora do MVP):**
- Gate pré-deploy (bloquear/alertar antes de promover uma mudança)
- Análise de runtime a partir de logs
- Novos adaptadores/domínios (Home Assistant, n8n, Kubernetes, etc.)

---

## 7. Time

Pedro (autor), Victor, André, Luiz, Nicolas.

_Dúvidas sobre rodar ou entender qualquer parte: falem com o Pedro._
