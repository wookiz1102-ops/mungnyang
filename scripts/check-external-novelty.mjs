// 이 글이 웹에 이미 있는 답의 재서술인지 검사한다.
//
// 2026-08 애드센스 2차 거절 사유가 "가치가 별로 없는 콘텐츠"였다.
// 초안을 쓴 content-writer 에이전트가 검색 도구 없이 88편을 썼고, 발행 게이트
// 5개(check-topic·check-duplication·count-body·verify-anchors·verify-faq-match)가
// 전부 자사 사이트 내부만 봐서 "웹에 이미 있는 답 대비 무엇을 더하는가"를
// 아무도 묻지 않았다. 실측 외부 출처 인용 7/88편.
//
// 노드 스크립트가 스스로 웹을 검색할 수는 없다. 그래서 글이 차별화 근거를
// 직접 선언하게 하고, 그 선언이 실재하고 검증 가능한지만 기계적으로 확인한다.
// 선언만 해 두고 본문에는 안 쓴 경우를 잡는 본문 대조가 핵심이다.
//
// 사용: node scripts/check-external-novelty.mjs posts/글.html [...]
// 종료 코드: 선언이 없거나 검증에 실패하면 1

import { readFileSync } from "node:fs";
import { basename } from "node:path";

const MIN_ITEMS = 3;
const OWN_DOMAIN = "daengnyangpedia.com";

// 본문 추출 — count-body.mjs 와 같은 보일러플레이트 제거.
// 단, 주석을 먼저 지운다. NOVELTY 선언 자체가 본문에 남아 있으면
// "본문에 등장하는가" 검사가 무조건 통과해 버린다.
function bodyText(html) {
  let t = html;
  t = t.replace(/<!--[\s\S]*?-->/g, "");
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
  t = t.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ");
  return t.replace(/\s+/g, " ").trim();
}

// 선언한 사실에서 "이 글에만 있는 것"을 가려내는 특징 토큰만 뽑는다.
// exact(금액·수치·영문)와 words(한글)를 나누는 이유는 요구 수준이 다르기 때문이다.
// 금액은 "1만 원"처럼 단위까지 한 덩어리로 잡는다. 숫자만 따로 세면 본문의 "1차"에
// 걸려 날조한 금액이 그대로 통과한다.
const MONEY = /\d[\d,]*\s*(?:만|억)?\s*원/g;
// 수치는 단위 한 글자까지 붙여 잡는다. 숫자만 떼면 "10일이고" 에서 "일이고" 가
// 한글 토큰으로 남아, 아무도 맞힐 수 없는 쓰레기가 분모만 키운다.
const NUMBER = /\d[\d,]*(?:\.\d+)?[가-힣%]?/g;

function tokens(fact) {
  const exact = new Set();
  let rest = fact;
  for (const m of rest.matchAll(MONEY)) exact.add(m[0]); // 금액
  rest = rest.replace(MONEY, " ");
  for (const m of rest.matchAll(NUMBER)) exact.add(m[0]); // 수치
  rest = rest.replace(NUMBER, " ");
  for (const m of rest.matchAll(/[A-Za-z][A-Za-z0-9'-]+/g)) exact.add(m[0]); // 약어·브랜드
  const words = new Set();
  for (const m of rest.matchAll(/[가-힣]{3,}/g)) words.add(m[0]); // 한글 복합어
  return { exact: [...exact], words: [...words] };
}

// 한글은 조사가 붙어 형태가 달라진다("과태료는" ↔ "과태료가"). 붙을 만한 조사만 뗀다.
// 앞뒤 글자 수로 자르면("부담금은" → "부담") 전혀 다른 낱말에 걸려 날조를 통과시킨다.
const JOSA = /(으로|이라는|라는|에서|에게|이며|이고|까지|부터|보다|마다|처럼|이나|은|는|이|가|을|를|의|도|에|로|만|과|와)$/;

function inBody(tok, body, bodyFlat) {
  if (body.includes(tok)) return true;
  // 수치는 쉼표·띄어쓰기 표기가 갈린다(3,000 ↔ 3000, 60만 원 ↔ 60만원).
  if (/\d/.test(tok)) return bodyFlat.includes(tok.replace(/[,\s]/g, ""));
  const stem = tok.replace(JOSA, "");
  return stem.length >= 2 && body.includes(stem);
}

// 한국 독자에게만 유효한 정보라는 신호(원 단위 금액은 MONEY 로 본다).
// 국제 의학 약어(BCS·cPL 등)는 번역해 온 정보와 구별되지 않으므로 신호로 치지 않는다.
const KR_SOURCE =
  /(동물보호법|수의사법|시행령|시행규칙|과태료|농림축산식품부|농림축산검역본부|식품의약품안전처|식약처|국가동물보호정보시스템|한국소비자원|공정거래위원회|지자체|시·군·구청|보건복지부|환경부)/;

function printFormat() {
  console.log("   글 안에 아래 형식의 주석 블록을 넣으세요.");
  console.log(`   웹에 이미 있는 답과 무엇이 다른지 ${MIN_ITEMS}가지 이상을 근거와 함께 선언해야 합니다.`);
  console.log("");
  console.log("   <!-- NOVELTY");
  console.log("   1. 이 글에만 있는 사실 | 근거 URL | 확인일(YYYY-MM-DD)");
  console.log("   2. ...");
  console.log("   3. ...");
  console.log("   -->");
}

function check(file) {
  const html = readFileSync(file, "utf8");
  const name = basename(file);

  const block = html.match(/<!--\s*NOVELTY([\s\S]*?)-->/);
  if (!block) {
    console.log(`❌ ${name} — NOVELTY 선언이 없습니다`);
    printFormat();
    return false;
  }

  const lines = block[1]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^\d+\.\s*\S/.test(l));

  if (lines.length < MIN_ITEMS) {
    console.log(`❌ ${name} — NOVELTY 항목 ${lines.length}개 (최소 ${MIN_ITEMS}개)`);
    console.log("   이 글만의 사실이 3가지도 없다면 이미 웹에 있는 글의 재서술입니다.");
    console.log("   주제를 좁히거나, 국내 기준·실제 비용·직접 확인한 절차를 조사해 채우세요.");
    return false;
  }

  const body = bodyText(html);
  const bodyFlat = body.replace(/[,\s]/g, "");
  const problems = [];

  lines.forEach((line, idx) => {
    const no = idx + 1;
    const parts = line.replace(/^\d+\.\s*/, "").split("|").map((p) => p.trim());
    if (parts.length !== 3) {
      problems.push(`[${no}] 형식 오류 — "사실 | 근거 URL | 확인일" 세 칸이 아닙니다: ${line.slice(0, 60)}`);
      return;
    }
    const [fact, url, date] = parts;

    if (!/^https?:\/\/[^\s]+\.[^\s]+$/.test(url)) {
      problems.push(`[${no}] 근거 URL 이 URL 형태가 아닙니다: ${url}`);
    } else if (url.includes(OWN_DOMAIN)) {
      problems.push(`[${no}] 자사 글은 외부 근거가 될 수 없습니다: ${url}`);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      problems.push(`[${no}] 확인일이 YYYY-MM-DD 형식이 아닙니다: ${date}`);
    }

    const { exact, words } = tokens(fact);
    if (exact.length + words.length === 0) {
      problems.push(`[${no}] 사실이 너무 막연합니다 — 수치나 고유명사를 넣으세요: ${fact}`);
      return;
    }
    const missExact = exact.filter((t) => !inBody(t, body, bodyFlat));
    const missWords = words.filter((t) => !inBody(t, body, bodyFlat));
    // 금액·수치·영문은 다르게 옮겨 적을 여지가 없으니 하나라도 없으면 선언만 한 것이다.
    // 한글은 서술이 달라질 수 있어 절반 이상만 요구한다.
    if (missExact.length > 0 || (words.length - missWords.length) * 2 < words.length) {
      problems.push(
        `[${no}] 선언한 사실이 본문에 없습니다\n` +
          `       선언: ${fact}\n` +
          `       본문에 없는 말: ${[...missExact, ...missWords].join(", ")}`,
      );
    }
  });

  if (problems.length > 0) {
    console.log(`❌ ${name} — NOVELTY ${lines.length}개 중 문제 ${problems.length}건`);
    for (const p of problems) console.log(`   ${p}`);
    console.log("   → 선언한 사실은 본문에 실제로 쓰여 있어야 하고, 근거는 외부 출처여야 합니다.");
    return false;
  }

  console.log(`✅ ${name} — NOVELTY ${lines.length}개 모두 외부 근거·본문 반영 확인`);

  if (!body.match(MONEY) && !KR_SOURCE.test(body)) {
    console.log("   ⚠️  국내 상황 특유의 정보가 없습니다 (원 단위 금액·국내 기관·법령 언급 0건).");
    console.log("      번역해 온 일반론처럼 읽힙니다. 국내 비용, 제도, 제품명 중 하나는 넣으세요.");
  }
  return true;
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("사용: node scripts/check-external-novelty.mjs posts/글.html [...]");
  process.exit(2);
}
const ok = files.map(check).every(Boolean);
process.exit(ok ? 0 : 1);
