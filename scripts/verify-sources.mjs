// 글이 외부 근거를 갖췄는지 검사한다.
//
// 2026년 애드센스 2차 거절 사유가 "가치가 별로 없는 콘텐츠"였다.
// content-writer 가 WebSearch/WebFetch 없이 88편을 썼고, 기존 게이트 5개는
// 전부 자사 사이트 내부만 봐서 "웹에 이미 있는 답 대비 무엇을 더하는가"를
// 아무도 묻지 않았다. 실측: 외부 출처 인용 7/88편, 본문 이미지 0장 70/88편.
//
// 사용: node scripts/verify-sources.mjs posts/글.html [...]
// 종료 코드: 기준 미달인 글이 하나라도 있으면 1

import { readFileSync } from "node:fs";
import { basename } from "node:path";

const MIN_LINKS = 2;
const MIN_IMAGES = 1;

// 자사 도메인과 마크업·애드테크 도메인은 "외부 근거"가 아니다.
const IGNORED = [
  "daengnyangpedia.com",
  "schema.org",
  "w3.org",
  "googlesyndication.com",
  "google-analytics.com",
  "googletagmanager.com",
  "doubleclick.net",
];

const hostOf = (url) =>
  (url.match(/^https?:\/\/([^/?#]+)/i) || ["", ""])[1].toLowerCase();

function check(file) {
  const name = basename(file);
  const html = readFileSync(file, "utf8");

  // head 의 canonical·og:url, header/footer 로고, JSON-LD 의 @id·url 을
  // 외부 근거로 오인하지 않도록 <article> 안만 본다.
  // 주석도 지운다. post-template.html 은 <article> 안에 안내 주석을 두는데,
  // 주석에 남은 예시 링크·이미지를 세면 독자에게 아무것도 안 보이는 글이 통과한다.
  const article = (html.match(/<article[\s\S]*<\/article>/i) || [""])[0]
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  const links = [
    ...new Set(
      [...article.matchAll(/href="(https?:\/\/[^"]+)"/gi)].map((m) => m[1]),
    ),
  ].filter((u) => {
    const h = hostOf(u);
    return !IGNORED.some((d) => h === d || h.endsWith(`.${d}`));
  });

  // alt 없는 img 는 접근성에도 검색에도 기여하지 않으므로 세지 않는다.
  const imgTags = [...article.matchAll(/<img\b[^>]*>/gi)]
    .map((m) => m[0])
    .filter((tag) => /\balt="[^"]+"/i.test(tag));

  // 직접 만든 인라인 SVG 도표도 이미지로 센다.
  // 이 규칙이 없던 동안 집필 에이전트가 게이트를 통과하려고 SVG 를 base64 data URI 로
  // 인코딩해 <img> 로 넣었다 — 사람이 고칠 수 없고 사이트 색·폰트도 못 물려받는 형태다.
  // 게이트가 잘못된 코드를 만들어낸 것이라 판정 쪽을 고친다.
  // 접근성 있는 것만 인정한다: role="img" + <title> 또는 aria-label.
  const svgFigures = [...article.matchAll(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi)]
    .map((m) => m[0])
    .filter((tag) => /role="img"/i.test(tag) && /(<title[\s>]|aria-label=")/i.test(tag));

  const images = [...imgTags, ...svgFigures];

  // 기존 88편은 목록 끝에 "(링크 확인일: 2026년 8월 28일)" 한 줄을 두지만,
  // post-template.html 은 링크마다 "· 확인 2026-08-30" 을 붙인다. 둘 다 인정한다.
  // 뒤에 연도를 요구해 "확인하세요" 같은 평범한 서술과 구별한다.
  const checkedOn = article.match(/확인일?\s*[:：]?\s*\d{4}\s*[-년]/);

  const problems = [];
  if (links.length < MIN_LINKS) {
    problems.push(`외부 권위 링크 ${links.length}개 — ${MIN_LINKS}개 이상 필요`);
  }
  if (images.length < MIN_IMAGES) {
    problems.push(`본문 이미지 ${images.length}장 — ${MIN_IMAGES}장 이상 필요`);
  }

  const ok = problems.length === 0;
  console.log(
    `${ok ? "✅" : "❌"} ${name} — 외부 링크 ${links.length}개, 본문 이미지 ${images.length}장`,
  );
  for (const p of problems) console.log(`   ${p}`);

  if (!ok && links.length) {
    console.log(`   센 링크: ${[...new Set(links.map(hostOf))].join(", ")}`);
  }
  if (links.length && !checkedOn) {
    console.log(
      "   ⚠️  링크 확인일 표기 없음 — 링크마다 \"· 확인 2026-08-30\" 형식으로 남기세요.",
    );
  }
  if (!ok) {
    console.log(
      "   → 수의학·정부 기관 같은 1차 자료를 본문에서 인용하고 '📚 참고한 자료' 섹션에 링크하세요.",
    );
    console.log("     (형식 예: posts/cat-diarrhea.html)");
  }
  return ok;
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("사용: node scripts/verify-sources.mjs posts/글.html [...]");
  process.exit(2);
}
const allOk = files.map(check).every(Boolean);
process.exit(allOk ? 0 : 1);
