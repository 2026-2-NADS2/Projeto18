// Roda o motor sobre um projeto de código (Java, Python ou C#).
// Uso:  npm run report:java    (ou report:python / report:csharp)
//       node src/cli/report-code.ts <java|python|csharp> [pasta]

import { scan, type Parser } from "../adapters/shared/scan.ts";
import { toRules } from "../adapters/shared/translate.ts";
import { parseJava } from "../adapters/java-spring/extract.ts";
import { parsePython } from "../adapters/python-django/extract.ts";
import { parseCSharp } from "../adapters/dotnet-mediatr/extract.ts";
import { runReport } from "./print.ts";

const LANGS: Record<string, { ext: string; parse: Parser; dir: string }> = {
  java: { ext: ".java", parse: parseJava, dir: "examples/pedidos-spring/services" },
  python: { ext: ".py", parse: parsePython, dir: "examples/pedidos-django/services" },
  csharp: { ext: ".cs", parse: parseCSharp, dir: "examples/pedidos-mediatr/services" },
};

const lang = process.argv[2];
const cfg = lang ? LANGS[lang] : undefined;
if (!cfg) {
  console.error(`uso: node src/cli/report-code.ts <${Object.keys(LANGS).join("|")}> [pasta]`);
  process.exit(1);
}

const dir = process.argv[3] ?? cfg.dir;
const items = scan(dir, cfg.ext, cfg.parse);
runReport(toRules(items), `${lang} em ${dir} (${items.length} handlers)`);
