// O "idioma padrão" (IR — Intermediate Representation).
// TODO adapter produz `Rule[]`; o core SÓ entende este formato e nada mais.
// core/ nunca importa de adapters/ — dependência de mão única.

/** Uma regra reativa normalizada (trigger de banco, automação, etc.) traduzida de algum sistema. */
export interface Rule {
  /** Identificador estável, único dentro do conjunto de regras. */
  id: string;
  /** Nome legível (ex.: "trg_apply_discount"). */
  name: string;
  /** A "coisa" que reage. Postgres: a tabela. */
  resource: string;
  /** O que dispara a regra. Postgres: "before update", "after insert", etc. */
  event: string;
  /** Campos/colunas que a regra LÊ. */
  reads: string[];
  /** Campos/colunas que a regra ESCREVE. */
  writes: string[];
  /**
   * Ordem de execução dentro do mesmo recurso+evento (menor roda primeiro).
   * Fornecida pelo adapter. Postgres: derivada do nome do trigger (ordem alfabética).
   * `undefined` => ordem desconhecida; read-after-write vira "ordem indefinida".
   */
  order?: number;
  /** Texto opaco da guarda/condição. NÃO é avaliado no MVP. */
  condition?: string;
  /** Qual adapter/domínio gerou esta regra. */
  source: string;
}

/** Chave de agrupamento do grafo: recurso × evento. */
export interface ResourceEventKey {
  resource: string;
  event: string;
}

/** O "Grafo de Interações": regras agrupadas por recurso+evento ("quem reage ao quê"). */
export interface InteractionGraph {
  /** chave `${resource}::${event}` -> regras do balde (ordenadas por `order`). */
  buckets: Map<string, Rule[]>;
}

export type Collision = WriteWriteCollision | ReadAfterWriteCollision;

/** Duas regras escrevem o mesmo campo no mesmo recurso+evento. */
export interface WriteWriteCollision {
  type: "write-write";
  resource: string;
  event: string;
  field: string;
  /** ids das duas regras, ordenados deterministicamente. */
  rules: [string, string];
}

/** Uma regra lê um campo que a outra escreve no mesmo recurso+evento (dependência de ordem). */
export interface ReadAfterWriteCollision {
  type: "read-after-write";
  resource: string;
  event: string;
  field: string;
  /** id da regra que LÊ. */
  reader: string;
  /** id da regra que ESCREVE. */
  writer: string;
  /**
   * reader-first  = leitor roda ANTES -> lê valor DESATUALIZADO (o bug clássico).
   * writer-first  = leitor roda DEPOIS -> lê o valor já alterado.
   * unknown       = uma das regras não tem `order` -> resultado imprevisível.
   */
  ordering: "reader-first" | "writer-first" | "unknown";
}
