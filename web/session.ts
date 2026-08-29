// Sessões da conversa, guardadas em memória (MVP — some se o servidor reinicia).
// Cada sessão prende os FATOS provados pelo motor + o histórico do chat, para
// que cada mensagem seja respondida ancorada no que já foi provado.

import { randomUUID } from "node:crypto";
import type { Collision, Rule } from "../src/core/model.ts";
import type { ChatTurn } from "../src/agent/chat.ts";

export interface Session {
  collisions: Collision[];
  rules: Rule[];
  history: ChatTurn[];
  created: number;
}

const sessions = new Map<string, Session>();

/** Cria uma sessão a partir dos fatos provados e devolve seu id. */
export function createSession(collisions: Collision[], rules: Rule[]): string {
  const id = randomUUID();
  sessions.set(id, { collisions, rules, history: [], created: Date.now() });
  return id;
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

/** Anexa um turno (user/model) ao histórico da sessão. */
export function appendTurn(id: string, role: ChatTurn["role"], text: string): void {
  const s = sessions.get(id);
  if (s) s.history.push({ role, text });
}
