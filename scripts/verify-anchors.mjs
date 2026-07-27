#!/usr/bin/env node
// 목차 링크 ↔ h2 id 일치, 내부 링크 대상 존재 여부 확인
import { readFileSync, existsSync } from "node:fs";
import { basename } from "node:path";

let fail = 0;
for (const f of process.argv.slice(2)) {
  const html = readFileSync(f, "utf8");
  const toc = (html.match(/<nav class="toc"[\s\S]*?<\/nav>/i) || [""])[0];
  const tocIds = [...toc.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
  const h2Ids = [...html.matchAll(/<h2 id="([^"]+)"/g)].map((m) => m[1]);
  const missing = tocIds.filter((i) => !h2Ids.includes(i));
  const extra = h2Ids.filter((i) => !tocIds.includes(i));
  const order = JSON.stringify(tocIds) === JSON.stringify(h2Ids);

  // 내부 링크(확장자 없는 상대 경로) 검증
  const body = html.replace(/<head[\s\S]*?<\/head>/i, "").replace(/<header[\s\S]*?<\/header>/i, "").replace(/<footer[\s\S]*?<\/footer>/i, "");
  const links = [...body.matchAll(/href="((?!#|https?:|\/")[^"]+)"/g)].map((m) => m[1]);
  const badLinks = [...new Set(links)].filter((l) => {
    if (l.startsWith("../")) return !existsSync(`${l.slice(3)}.html`);
    return !existsSync(`posts/${l}.html`);
  });

  const ok = !missing.length && !extra.length && order && !badLinks.length;
  if (!ok) fail = 1;
  console.log(`${ok ? "✅" : "❌"} ${basename(f)}  h2=${h2Ids.length} toc=${tocIds.length} 순서일치=${order}`);
  if (missing.length) console.log(`   목차에만 있음: ${missing.join(", ")}`);
  if (extra.length) console.log(`   h2에만 있음: ${extra.join(", ")}`);
  if (badLinks.length) console.log(`   깨진 링크: ${badLinks.join(", ")}`);
}
process.exit(fail);
