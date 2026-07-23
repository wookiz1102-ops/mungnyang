#!/usr/bin/env node
// 카카오톡 "나에게 보내기" 최초 1회 인증 — 리프레시 토큰을 발급해 저장한다.
//
// 사전 준비 (카카오 개발자 콘솔 https://developers.kakao.com):
//   1) 내 애플리케이션 → 애플리케이션 추가하기 (앱 이름 아무거나)
//   2) 앱 설정 → 앱 키 → "REST API 키" 복사
//   3) 카카오 로그인 → 활성화 ON, Redirect URI에 http://localhost:8123/callback 등록
//   4) 카카오 로그인 → 동의항목 → "카카오톡 메시지 전송(talk_message)" 사용 설정
//
// 실행 (미니PC에서):
//   node scripts/kakao-auth.mjs <REST_API_키>  [저장경로(기본 C:\srv\kakao-token.json)]
//   → 브라우저가 열리면 카카오 로그인·동의 → 저장 완료 메시지가 뜨면 끝.

import { createServer } from "node:http";
import { writeFileSync } from "node:fs";
import { execFile } from "node:child_process";

const restApiKey = process.argv[2];
const tokenFile = process.argv[3] || "C:\\srv\\kakao-token.json";
const redirectUri = "http://localhost:8123/callback";

if (!restApiKey) {
  console.error("사용법: node scripts/kakao-auth.mjs <REST_API_키> [저장경로]");
  process.exit(1);
}

const authUrl =
  "https://kauth.kakao.com/oauth/authorize?" +
  new URLSearchParams({
    client_id: restApiKey,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "talk_message",
  });

const server = createServer(async (req, res) => {
  const u = new URL(req.url, "http://localhost:8123");
  if (u.pathname !== "/callback") { res.writeHead(404); res.end(); return; }
  const code = u.searchParams.get("code");
  if (!code) { res.writeHead(400); res.end("code 파라미터가 없습니다."); return; }
  try {
    const r = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: restApiKey,
        redirect_uri: redirectUri,
        code,
      }),
    });
    const j = await r.json();
    if (!j.refresh_token) throw new Error(JSON.stringify(j));
    writeFileSync(
      tokenFile,
      JSON.stringify({ restApiKey, refreshToken: j.refresh_token }, null, 2),
      "utf8",
    );
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end("<h2>✅ 카카오 인증 완료! 이 창을 닫으셔도 됩니다.</h2>");
    console.log("저장 완료:", tokenFile);
    setTimeout(() => process.exit(0), 500);
  } catch (e) {
    res.writeHead(500, { "content-type": "text/html; charset=utf-8" });
    res.end("토큰 발급 실패: " + e.message);
    console.error("토큰 발급 실패:", e.message);
    process.exit(1);
  }
});

server.listen(8123, () => {
  console.log("아래 주소가 브라우저에서 열립니다. 카카오 로그인·동의를 진행하세요:\n" + authUrl);
  execFile("cmd", ["/c", "start", "", authUrl]); // 윈도우 기본 브라우저로 열기
});
