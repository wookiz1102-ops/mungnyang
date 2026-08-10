// FAQPage JSON-LD 와 본문 FAQ 가 일치하는지 검사한다.
//
// 구글은 구조화 데이터로 표시한 Q&A 가 페이지에 그대로 보일 것을 요구한다.
// 마크업에만 있는 질문이나, 본문보다 자세한 답변은 정책 위반이다.
//
// 2026-07-30 PR #55 에서 사람이 잡았고, 2026-08-10 cat-scratcher-guide 에서
// 같은 결함이 게이트를 통과해 발행됐다. 검사가 없어서였다.
//
// 사용: node scripts/verify-faq-match.mjs posts/글.html [...]
// 종료 코드: 불일치가 하나라도 있으면 1

import { readFileSync } from "node:fs";
import { basename } from "node:path";

const norm = (s) =>
  s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

function check(file) {
  const html = readFileSync(file, "utf8");
  const name = basename(file);

  // JSON-LD 쪽 FAQ
  let jsonld = null;
  for (const m of html.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
  )) {
    let data;
    try {
      data = JSON.parse(m[1]);
    } catch {
      console.log(`❌ ${name} — JSON-LD 파싱 실패`);
      return false;
    }
    for (const node of Array.isArray(data) ? data : [data]) {
      if (node && node["@type"] === "FAQPage") {
        jsonld = (node.mainEntity ?? []).map((q) => [
          norm(q.name ?? ""),
          norm(q.acceptedAnswer?.text ?? ""),
        ]);
      }
    }
  }

  // 본문 쪽 FAQ (<details><summary>Q. 질문</summary><p>답변</p>)
  const body = html.replace(/<script[\s\S]*?<\/script>/g, "");
  const onpage = [
    ...body.matchAll(
      /<details>\s*<summary>Q\.\s*([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>/g,
    ),
  ].map((m) => [norm(m[1]), norm(m[2])]);

  // FAQPage 마크업이 아예 없으면 검사 대상이 아니다(FAQ 없는 글도 있다).
  if (jsonld === null) {
    console.log(`➖ ${name} — FAQPage 마크업 없음 (검사 대상 아님)`);
    return true;
  }

  if (jsonld.length !== onpage.length) {
    console.log(
      `❌ ${name} — 개수 불일치: JSON-LD ${jsonld.length}개 / 본문 ${onpage.length}개`,
    );
    return false;
  }

  const bad = [];
  jsonld.forEach(([jq, ja], i) => {
    const [bq, ba] = onpage[i];
    if (jq !== bq) bad.push({ i: i + 1, what: "질문", a: jq, b: bq });
    if (ja !== ba) bad.push({ i: i + 1, what: "답변", a: ja, b: ba });
  });

  if (bad.length === 0) {
    console.log(`✅ ${name} — FAQ ${jsonld.length}개 질문·답변 모두 일치`);
    return true;
  }

  console.log(`❌ ${name} — 불일치 ${bad.length}건`);
  for (const d of bad) {
    console.log(`   [${d.i}] ${d.what}`);
    console.log(`       JSON-LD: ${d.a.slice(0, 90)}`);
    console.log(`       본문   : ${d.b.slice(0, 90)}`);
  }
  console.log(
    "   → 마크업한 Q&A 는 페이지에 그대로 보여야 합니다(구글 구조화 데이터 정책).",
  );
  console.log(
    "     본문과 JSON-LD 중 한쪽을 다른 쪽에 맞춰 문자열까지 동일하게 만드세요.",
  );
  return false;
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("사용: node scripts/verify-faq-match.mjs posts/글.html [...]");
  process.exit(2);
}
const ok = files.map(check).every(Boolean);
process.exit(ok ? 0 : 1);
