# Grafo de Interações — "O bug que ninguém escreveu"

Motor que lê **todas as regras reativas** de um sistema, monta um mapa de *quem
reage ao quê* e aponta **onde duas regras vão brigar** — antes de dar problema.

> TCC · Time: Pedro, Victor, André, Luiz, Nicolas · **Fase 1 (o motor, sem IA)**

## A ideia em uma frase

O problema não está na peça, está no conjunto: duas regras corretas, cada uma
passando isolada, brigam quando convivem no mesmo recurso e evento.

## Arquitetura (dependência de mão única)

```
src/
  core/       # o MOTOR — agnóstico. NUNCA importa de adapters/
    model.ts     # o "idioma padrão" (IR): Rule, InteractionGraph, Collision
    graph.ts     # buildGraph(): agrupa regras por recurso × evento
    detector.ts  # findCollisions(): acha as brigas (determinístico, sem IA)
  adapters/   # os TRADUTORES — um por sistema (traduz sistema real -> IR)
    postgres/       # lê triggers de um banco Postgres real
    node-events/    # lê handlers de um backend de microsserviços Node (event bus)
    java-spring/    # lê métodos @EventListener (Spring)
    python-django/  # lê @receiver de signals (Django)
    dotnet-mediatr/ # lê INotificationHandler<T> (MediatR / .NET C#)
    shared/         # base comum dos adapters de código (scan/text/translate)
  agent/      # a IA (Fase 2) — explica as brigas provadas. Importa do core; o core nunca daqui
    offline.ts   # explicador determinístico por template (sem rede) — o fallback
    llm-gemini.ts# chama a API do Gemini via fetch nativo (zero dependência)
    prompt.ts    # monta o prompt ancorado nos fatos + valida o JSON de volta
    explain.ts   # o maestro: tem chave? Gemini : offline
  cli/        # os comandos de terminal
    report.ts    # relatório determinístico (Fase 1)
    explain.ts   # relatório + explicação em linguagem natural (Fase 2)
fixtures/     # exemplos em IR para provar o motor sem sistema real conectado
examples/     # sistemas-exemplo reais com brigas plantadas (ex.: microsserviços)
test/
```

O mesmo motor roda em sistemas totalmente diferentes trocando só o adapter:

- **Postgres** — ordem de disparo é garantida (alfabética do nome do trigger),
  então read-after-write sai como `reader-first` (lê valor velho).
- **Microsserviços / Spring / Django / MediatR** — não há ordem garantida entre
  consumidores/listeners/handlers, então read-after-write sai como `unknown`
  (**resultado imprevisível** — o pesadelo distribuído).

Os adapters de código (Java, Python, C#) compartilham a mesma base em
`adapters/shared/` (varredura de pastas + utilitários de texto): criar um novo
tradutor de linguagem custa só um extrator (`parseX`) de ~15 linhas.

## Tipos de colisão detectados (MVP)

- **write-write** — duas regras escrevem o **mesmo campo** no mesmo recurso+evento.
- **read-after-write** — uma regra **lê** um campo que outra **escreve** (dependência
  de ordem). Anotado com `reader-first` (lê valor desatualizado — o bug clássico),
  `writer-first` ou `unknown`.

## Rodar (requer Node >= 22.6 — sem `npm install`)

```bash
npm test                                           # roda todos os testes
npm run report -- fixtures/postgres-example.json   # relatório do fixture
npm run report:pg                                  # lê de um Postgres real (Postgres.app)
npm run report:node                                # lê o backend de microsserviços de exemplo
npm run report:java                                # lê o backend Spring de exemplo
npm run report:python                              # lê o backend Django de exemplo
npm run report:csharp                              # lê o backend MediatR (.NET) de exemplo
```

O núcleo é **100% funções puras, zero I/O, zero IA**. A IA só entra na Fase 2,
raciocinando sobre o resultado que este motor prova.

## Fase 2 — diagnóstico em linguagem natural (shieldPy, via Gemini)

O comando `explain` roda o motor e **diagnostica** cada colisão em linguagem
natural. A IA **nunca descobre** brigas — ela só interpreta as que o motor
determinístico já provou (cada diagnóstico carrega a `collision` de origem:
rastreabilidade total). É uma camada **neuro-simbólica**: o motor prova
(símbolo), o LLM comunica (neural).

```bash
npm run explain -- node      # (java | python | csharp | pg | fixture <arquivo>)
```

O agente tem persona fixa — **shieldPy**, um Especialista Sênior em DevOps — e
opera sob **guardrails**:

- **Entrada:** mascara tokens/chaves/senhas/PII com `***` e trata os metadados
  como *dados* (ignora instruções embutidas — anti prompt-injection).
- **Escopo read-only:** é um analisador declarativo; nunca sugere comandos
  destrutivos (`kubectl delete`, `rm -rf`, `git push --force`) e recusa tarefas
  fora do escopo de conflitos de metadados.
- **Saída obrigatória (estrutura declarativa):** `Status`
  (Colisão Identificada / Sem Colisão / Requer Revisão Humana), `Severidade`
  (Baixo / Médio / Alto / Crítico), Mapeamento do Conflito (Chave/Namespace
  Afetado, Origens em Conflito, Causa Raiz) e Recomendação Declarativa.
- **Governança (human-in-the-loop):** confiança < 85% força o Status para
  **"Requer Revisão Humana"**.

Modos de execução:

- **Com IA (Google Gemini):** copie `.env.example` para `.env`, preencha
  `GEMINI_API_KEY` (crie em https://aistudio.google.com/apikey) e rode. Free tier.
- **Sem chave/internet:** cai automaticamente no **explicador offline**
  (determinístico, por template, confiança 100%) — a demo nunca falha
  (*graceful degradation*). O relatório mostra a origem do texto
  (`IA (Gemini)` ou `explicador offline`).

Trocar de LLM = trocar só `src/agent/llm-*.ts`; o resto do sistema é agnóstico de IA.
