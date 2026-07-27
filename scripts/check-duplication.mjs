#!/usr/bin/env node
// 새 글이 기존 글과 얼마나 겹치는지 측정 — 자동 발행 전 중복 게이트용.
//
// 사용법:  node scripts/check-duplication.mjs posts/새글.html
// 출력:    가장 많이 겹치는 기존 글 상위 5개와 12-gram 중첩률(%)
// 종료코드: 중첩률 20% 이상이면 1 (FAIL), 아니면 0
//
// 보일러플레이트(헤더/푸터/목차/관련글/면책/스크립트)는 제외하고 본문만 비교한다.

import { readFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";

const THRESHOLD = 20; // %
const target = process.argv[2];
if (!target) {
  console.error("사용법: node scripts/check-duplication.mjs posts/<파일>.html");
  process.exit(2);
}

const POSTS_DIR = "posts";
const N = 12; // n-gram 크기

function bodyText(html) {
  let t = html;
  // 보일러플레이트 제거
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
  // 태그 제거 → 공백 정규화
  t = t.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ");
  return t.replace(/\s+/g, " ").trim();
}

function ngrams(s, n) {
  const set = new Set();
  for (let i = 0; i + n <= s.length; i++) set.add(s.slice(i, i + n));
  return set;
}

const targetText = bodyText(readFileSync(target, "utf8"));
if (targetText.length < N) {
  console.log("본문이 너무 짧아 비교 불가");
  process.exit(0);
}
const targetGrams = ngrams(targetText, N);

const results = [];
for (const f of readdirSync(POSTS_DIR)) {
  if (!f.endsWith(".html")) continue;
  if (f.startsWith("_")) continue;
  const path = join(POSTS_DIR, f);
  if (basename(path) === basename(target)) continue;
  const other = ngrams(bodyText(readFileSync(path, "utf8")), N);
  let hit = 0;
  for (const g of targetGrams) if (other.has(g)) hit++;
  results.push({ file: f, pct: (hit / targetGrams.size) * 100 });
}

results.sort((a, b) => b.pct - a.pct);
console.log(`\n[중복 검사] ${basename(target)} (본문 ${targetText.length}자)\n`);
for (const r of results.slice(0, 5)) {
  console.log(`  ${r.pct.toFixed(1).padStart(5)}%  ${r.file}`);
}

const worst = results[0];
if (worst && worst.pct >= THRESHOLD) {
  console.log(`\n❌ FAIL — ${worst.file} 와 ${worst.pct.toFixed(1)}% 중첩 (기준 ${THRESHOLD}% 미만)`);
  process.exit(1);
}
console.log(`\n✅ PASS — 최대 중첩 ${worst ? worst.pct.toFixed(1) : 0}% (기준 ${THRESHOLD}% 미만)`);
process.exit(0);
