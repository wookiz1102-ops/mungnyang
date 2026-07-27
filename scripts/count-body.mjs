#!/usr/bin/env node
// 본문 글자 수 측정 (공백 제외)
// 제외: head/header/footer/script/style/nav.toc/.related/.disclaimer-box/.ad-slot/.breadcrumb/figure.breed-photo
// 사용법: node scripts/count-body.mjs posts/a.html posts/b.html ...

import { readFileSync } from "node:fs";
import { basename } from "node:path";

function bodyText(html) {
  let t = html;
  t = t.replace(/<head[\s\S]*?<\/head>/gi, "");
  t = t.replace(/<header[\s\S]*?<\/header>/gi, "");
  t = t.replace(/<footer[\s\S]*?<\/footer>/gi, "");
  t = t.replace(/<script[\s\S]*?<\/script>/gi, "");
  t = t.replace(/<style[\s\S]*?<\/style>/gi, "");
  t = t.replace(/<nav class="toc"[\s\S]*?<\/nav>/gi, "");
  t = t.replace(/<div class="related"[\s\S]*?<\/div>/gi, "");
  t = t.replace(/<div class="disclaimer-box"[\s\S]*?<\/div>/gi, "");
  t = t.replace(/<div class="ad-slot"[\s\S]*?<\/div>/gi, "");
  t = t.replace(/<p class="breadcrumb"[\s\S]*?<\/p>/gi, "");
  t = t.replace(/<figure class="breed-photo"[\s\S]*?<\/figure>/gi, "");
  t = t.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ");
  return t;
}

let fail = 0;
for (const f of process.argv.slice(2)) {
  const n = bodyText(readFileSync(f, "utf8")).replace(/\s+/g, "").length;
  const ok = n >= 2200;
  if (!ok) fail = 1;
  console.log(`${ok ? "✅" : "❌"} ${String(n).padStart(5)}자  ${basename(f)}`);
}
process.exit(fail);
