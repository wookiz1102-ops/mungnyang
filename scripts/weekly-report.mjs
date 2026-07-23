#!/usr/bin/env node
// 주간 데이터 리포트 — GA4 + Search Console 요약을 GitHub 이슈로 등록
// 실행: node scripts/weekly-report.mjs [설정파일]   (기본: C:\srv\report-config.json)
// 설정 예: {"propertyId":"123456789","keyFile":"C:\\srv\\ga-key.json",
//           "site":"sc-domain:daengnyangpedia.com","repo":"C:\\srv\\mungnyang"}
// 의존성 없음(Node 18+ 내장 fetch/crypto). 구글 서비스 계정 키 필요.

import { readFileSync, writeFileSync } from "node:fs";
import { createSign } from "node:crypto";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cfgPath = process.argv[2] || "C:\\srv\\report-config.json";
const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
const key = JSON.parse(readFileSync(cfg.keyFile, "utf8"));

// ── 구글 서비스 계정 토큰 (JWT RS256) ─────────────────────────
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  const unsigned =
    b64url({ alg: "RS256", typ: "JWT" }) + "." +
    b64url({
      iss: key.client_email,
      scope: "https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now, exp: now + 3600,
    });
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const jwt = unsigned + "." + signer.sign(key.private_key, "base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!r.ok) throw new Error("구글 토큰 발급 실패: " + (await r.text()));
  return (await r.json()).access_token;
}

async function post(url, token, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { authorization: "Bearer " + token, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(url.split("?")[0] + " 실패: " + (await r.text()));
  return r.json();
}

// ── 날짜 유틸 ─────────────────────────────────────────────────
const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const label = (iso) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
const num = (v) => Number(v || 0);
const fmt = (v) => num(v).toLocaleString("ko-KR");
const delta = (cur, prev) => {
  cur = num(cur); prev = num(prev);
  if (prev === 0) return cur > 0 ? "(신규 ↑)" : "(±0)";
  const p = Math.round(((cur - prev) / prev) * 100);
  return p > 0 ? `(▲${p}%)` : p < 0 ? `(▼${Math.abs(p)}%)` : "(±0)";
};

// GA4: 어제까지 7일 / 서치콘솔: 데이터 지연 때문에 3일 전까지 7일
const ga = { curStart: day(-7), curEnd: day(-1), prevStart: day(-14), prevEnd: day(-8) };
const sc = { curStart: day(-9), curEnd: day(-3), prevStart: day(-16), prevEnd: day(-10) };

// ── GA4 ───────────────────────────────────────────────────────
async function ga4Section(token) {
  const base = `https://analyticsdata.googleapis.com/v1beta/properties/${cfg.propertyId}:runReport`;
  const totals = await post(base, token, {
    dateRanges: [
      { startDate: ga.curStart, endDate: ga.curEnd },
      { startDate: ga.prevStart, endDate: ga.prevEnd },
    ],
    metrics: [
      { name: "activeUsers" }, { name: "sessions" }, { name: "screenPageViews" },
      { name: "engagedSessions" }, { name: "userEngagementDuration" },
    ],
  });
  const cur = totals.rows?.find((r) => r.dimensionValues?.[0]?.value === "date_range_0")?.metricValues
    ?? totals.rows?.[0]?.metricValues ?? [];
  const prev = totals.rows?.find((r) => r.dimensionValues?.[0]?.value === "date_range_1")?.metricValues ?? [];
  const m = (row, i) => row?.[i]?.value ?? 0;

  const pages = await post(base, token, {
    dateRanges: [{ startDate: ga.curStart, endDate: ga.curEnd }],
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "screenPageViews" }],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: 5,
  });
  const channels = await post(base, token, {
    dateRanges: [{ startDate: ga.curStart, endDate: ga.curEnd }],
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: [{ name: "sessions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 5,
  });

  // 봇에 강한 지표: 참여 세션(봇은 참여 0) + 검색 유입(위조 어려움)
  const engCur = num(m(cur, 3)), engPrev = num(m(prev, 3));
  const avgEngCur = num(m(cur, 0)) ? Math.round(num(m(cur, 4)) / num(m(cur, 0))) : 0;
  const organicRow = channels.rows?.find((r) => r.dimensionValues[0].value === "Organic Search");
  const organicCur = organicRow ? num(organicRow.metricValues[0].value) : 0;

  let out = `## 🌐 방문 (GA4, ${label(ga.curStart)}~${label(ga.curEnd)})\n`;
  out += `> ⚠️ 전체 수치엔 해외 봇/스팸이 섞여 있습니다. **아래 '실제 유입'을 신뢰하세요.**\n\n`;
  out += `**🎯 실제 유입 (봇에 강한 지표)**\n`;
  out += `- 참여 세션(실제로 읽은 방문): **${fmt(engCur)}회** ${delta(engCur, engPrev)}\n`;
  out += `- 검색 유입(구글·네이버): **${fmt(organicCur)}세션** — 봇이 위조하기 가장 어려운 신호\n`;
  out += `- 평균 참여 시간: **${avgEngCur}초/명**\n\n`;
  out += `**전체 (봇 포함 · 참고용)**\n`;
  out += `- 방문자: ${fmt(m(cur, 0))}명 ${delta(m(cur, 0), m(prev, 0))}\n`;
  out += `- 세션: ${fmt(m(cur, 1))}회 · 페이지뷰: ${fmt(m(cur, 2))}회\n`;
  if (pages.rows?.length) {
    out += `\n**많이 본 페이지**\n`;
    for (const r of pages.rows)
      out += `- \`${r.dimensionValues[0].value}\` — ${fmt(r.metricValues[0].value)}회\n`;
  }
  if (channels.rows?.length) {
    out += `\n**유입 경로**\n`;
    for (const r of channels.rows) {
      const ch = r.dimensionValues[0].value;
      const tag = ch === "Direct" ? " _(대부분 봇/스팸 추정)_" : ch === "Organic Search" ? " ✅" : "";
      out += `- ${ch}: ${fmt(r.metricValues[0].value)}세션${tag}\n`;
    }
  }
  return { md: out, hi: `👀 참여세션 ${fmt(engCur)} · 🔍 검색유입 ${fmt(organicCur)}세션` };
}

// ── Search Console ────────────────────────────────────────────
async function gscSection(token) {
  const base = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(cfg.site)}/searchAnalytics/query`;
  const q = (startDate, endDate, extra = {}) =>
    post(base, token, { startDate, endDate, ...extra });

  const cur = await q(sc.curStart, sc.curEnd);
  const prev = await q(sc.prevStart, sc.prevEnd);
  const queries = await q(sc.curStart, sc.curEnd, { dimensions: ["query"], rowLimit: 5 });

  const t = (res, f) => num(res.rows?.[0]?.[f]);
  let out = `## 🔍 구글 검색 (서치콘솔, ${label(sc.curStart)}~${label(sc.curEnd)})\n`;
  out += `- 클릭: **${fmt(t(cur, "clicks"))}회** ${delta(t(cur, "clicks"), t(prev, "clicks"))}\n`;
  out += `- 노출: **${fmt(t(cur, "impressions"))}회** ${delta(t(cur, "impressions"), t(prev, "impressions"))}\n`;
  if (t(cur, "impressions") > 0)
    out += `- 평균 순위: ${(cur.rows?.[0]?.position ?? 0).toFixed(1)}위\n`;
  if (queries.rows?.length) {
    out += `\n**유입 검색어 TOP**\n`;
    for (const r of queries.rows)
      out += `- "${r.keys[0]}" — 클릭 ${fmt(r.clicks)} / 노출 ${fmt(r.impressions)}\n`;
  } else if (t(cur, "impressions") === 0) {
    out += `\n_아직 검색 노출 데이터가 없어요. 색인이 붙는 중입니다 — 정상이에요._\n`;
  }
  return { md: out, hi: `🔍 검색 클릭 ${fmt(t(cur, "clicks"))} · 노출 ${fmt(t(cur, "impressions"))}` };
}

// ── 이번 주 발행 글 ───────────────────────────────────────────
function publishedSection() {
  try {
    const outText = execFileSync(
      "git",
      ["log", "--since=7 days ago", "--diff-filter=A", "--name-only", "--pretty=format:", "--", "posts/"],
      { cwd: cfg.repo, encoding: "utf8" },
    );
    const files = [...new Set(
      outText.split("\n")
        .map((l) => l.trim())
        .filter((l) => l.endsWith(".html") && !/(^|\/)_[^/]*$/.test(l)),
    )];
    let out = `## ✍️ 이번 주 발행 (${files.length}편)\n`;
    for (const f of files)
      out += `- https://daengnyangpedia.com/${f.replace(/\.html$/, "")}\n`;
    if (!files.length) out += `_이번 주 새 글이 없습니다._\n`;
    return { md: out, hi: `✍️ 발행 ${files.length}편` };
  } catch (e) {
    return { md: `## ✍️ 이번 주 발행\n_확인 실패: ${e.message}_\n`, hi: null };
  }
}

// ── 카카오톡 "나에게 보내기" (선택: kakao-token.json 있을 때만 동작) ──
async function sendKakao(title, highlights, issueUrl) {
  const tokenFile = cfg.kakaoToken || "C:\\srv\\kakao-token.json";
  let tok;
  try { tok = JSON.parse(readFileSync(tokenFile, "utf8")); }
  catch { return; } // 토큰 파일 없으면 조용히 건너뜀 (카톡 미설정 상태)
  try {
    // 1) 리프레시 토큰으로 액세스 토큰 갱신 (주간 실행이라 항상 만료 상태)
    const r = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: tok.restApiKey,
        refresh_token: tok.refreshToken,
      }),
    });
    const j = await r.json();
    if (!j.access_token) throw new Error("토큰 갱신 실패: " + JSON.stringify(j));
    if (j.refresh_token) { // 카카오가 새 리프레시 토큰을 주면 저장(만료 방지)
      tok.refreshToken = j.refresh_token;
      writeFileSync(tokenFile, JSON.stringify(tok, null, 2), "utf8");
    }
    // 2) 나에게 보내기 (텍스트 템플릿 200자 제한 → 요약 + 전체 링크 버튼)
    const text = `📊 ${title}\n${highlights.join("\n")}\n\n전체 리포트 보기 ↓`.slice(0, 195);
    const send = await fetch("https://kapi.kakao.com/v2/api/talk/memo/default/send", {
      method: "POST",
      headers: {
        authorization: "Bearer " + j.access_token,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        template_object: JSON.stringify({
          object_type: "text",
          text,
          link: { web_url: issueUrl, mobile_web_url: issueUrl },
          button_title: "전체 보기",
        }),
      }),
    });
    if (!send.ok) throw new Error("카카오 전송 실패: " + (await send.text()));
    console.log("카카오톡 전송 완료");
  } catch (e) {
    console.log("카카오톡 전송 건너뜀:", e.message); // 실패해도 리포트는 이미 등록됨
  }
}

// ── 실행 ──────────────────────────────────────────────────────
const sections = [], highlights = [];
const add = (r) => { sections.push(typeof r === "string" ? r : r.md); if (r && r.hi) highlights.push(r.hi); };
let token = null;
try {
  token = await accessToken();
} catch (e) {
  add(`> ⚠️ 구글 API 인증 실패 — 키 파일/권한을 확인하세요.\n> ${e.message}`);
}
if (token) {
  try { add(await ga4Section(token)); }
  catch (e) { add(`## 🌐 방문 (GA4)\n_조회 실패: ${e.message}_`); }
  try { add(await gscSection(token)); }
  catch (e) { add(`## 🔍 구글 검색 (서치콘솔)\n_조회 실패: ${e.message}_`); }
}
add(publishedSection());
sections.push(`---\n_자동 생성 리포트 · GA4 기준 ${ga.curStart} ~ ${ga.curEnd} (서치콘솔은 집계 지연으로 3일 전까지)_`);

const title = `📊 주간 리포트 (${label(ga.curStart)} ~ ${label(ga.curEnd)})`;
const bodyFile = join(tmpdir(), "daengnyang-weekly-report.md");
writeFileSync(bodyFile, sections.join("\n\n"), "utf8");

const issueUrl = execFileSync(
  "gh",
  ["issue", "create", "--title", title, "--body-file", bodyFile, "--label", "report"],
  { cwd: cfg.repo, encoding: "utf8" },
).trim();
console.log("리포트 이슈 등록 완료:", title, issueUrl);

await sendKakao(title, highlights, issueUrl);
