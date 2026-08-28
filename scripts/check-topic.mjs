// 새 글 주제(슬러그)가 기존 글과 겹치는지 발행 전에 확인한다.
//
// keyword-researcher 에 "종만 바꾼 주제 금지" 규칙이 산문으로 있었지만 지켜지지 않았다.
// 2026-08-27 dog-nail-trim 이 cat-nail-trim 과 25.5% 중복으로 게이트에 걸렸고,
// 그 시점 이미 종만 다른 짝이 9쌍 있었다. 산문 규칙 대신 실행되는 검사로 만든다.
//
// 사용: node scripts/check-topic.mjs <제안-슬러그>
// 종료 코드: 0 통과 / 1 차단(이미 있음) / 2 주의(종 짝 존재 — 근거 필요)

import { readdirSync } from "node:fs";

const slug = (process.argv[2] || "").trim().replace(/\.html$/, "");
if (!slug) {
  console.error("사용: node scripts/check-topic.mjs <제안-슬러그>");
  process.exit(64);
}

const existing = readdirSync("posts")
  .filter((f) => f.endsWith(".html"))
  .map((f) => f.slice(0, -5));

// 1) 같은 슬러그가 이미 있는가
if (existing.includes(slug)) {
  console.log(`❌ 차단 — posts/${slug}.html 이 이미 있습니다. 다른 주제를 고르세요.`);
  process.exit(1);
}

// 2) 종만 바꾼 짝이 있는가
const SP = [
  ["dog-", "cat-"],
  ["cat-", "dog-"],
  ["puppy-", "kitten-"],
  ["kitten-", "puppy-"],
];
const counterparts = SP.filter(([a]) => slug.startsWith(a)).map(
  ([a, b]) => b + slug.slice(a.length),
).filter((c) => existing.includes(c));

// 3) 종 접두어를 뗀 핵심어가 같은 글이 있는가 (pet- 등 다른 접두어까지)
const core = slug.replace(/^(dog|cat|puppy|kitten|pet)-/, "");
const sameCore = existing.filter(
  (e) => e !== slug && e.replace(/^(dog|cat|puppy|kitten|pet)-/, "") === core,
);

const flagged = [...new Set([...counterparts, ...sameCore])];

if (flagged.length === 0) {
  console.log(`✅ 통과 — "${slug}" 과 겹치는 기존 글이 없습니다.`);
  process.exit(0);
}

console.log(`⚠️  주의 — "${slug}" 은 기존 글과 대상 종만 다른 주제로 보입니다.`);
for (const f of flagged) console.log(`     기존: posts/${f}.html`);
console.log("");
console.log("  이대로 쓰면 본문이 크게 겹쳐 publish-reviewer 에서 FAIL 이 납니다.");
console.log("  (2026-08-27 dog-nail-trim ↔ cat-nail-trim 25.5% 중복 사례)");
console.log("");
console.log("  둘 중 하나를 택하세요.");
console.log("  (가) 다른 주제로 바꾼다 — 기본값. 이쪽을 권장합니다.");
console.log("  (나) 그 종에만 해당하는 구별되는 각도가 최소 3개 있으면 진행하되,");
console.log("       무엇인지 3가지를 명시하고 기존 글과 겹치는 서술은 링크로 대체하라.");
console.log("       (예: 강아지 발톱이라면 '산책 마모로 인한 퀵 후퇴 / 며느리발톱 /");
console.log("        그라인더 소리 둔감화' 처럼 상대 종 글에서 다룰 수 없는 내용)");
process.exit(2);
