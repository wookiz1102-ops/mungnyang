---
description: 검토가 끝난 drafts/ 초안을 사이트에 편입하고 배포 (push 전 최종 확인)
argument-hint: <초안 slug 또는 파일명>
---

`drafts/`의 "$ARGUMENTS" 초안을 **정식 발행**한다. 순서대로 수행하라:

1. **편입** — 초안을 `posts/<slug>.html`로 이동하고, `<head>`의 `robots noindex` 메타를 **제거**한다.
   발행일 관련 값(`.post-meta`, JSON-LD `datePublished`, sitemap `lastmod`)을 **오늘 날짜**로 맞춘다.
2. **internal-linker** — 새 글을 사이트에 연결한다:
   `sitemap.xml`(url 추가) · 해당 카테고리 목록 페이지 · `index.html` 최신 글 ·
   `js/search-data.js` · (관련 시)`js/breed-data.js` · 본문 `.related` 블록.
   기존 아키텍처 유지(품종=엄선 링크, 카테고리=본진).
3. **deploy-qa** — 배포 전 체크리스트를 돌린다: 깨진 링크·상대경로, JSON-LD 유효성,
   모바일 375px, 콘솔 에러, Pretendard·GA4 로드. **문제가 있으면 멈추고 보고**한다.
4. **배포** — 점검 통과 시 변경된 파일만 `git add` → 한국어 커밋 메시지
   (마지막 줄 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`)로 커밋.
   **`git push origin main` 실행 전에 사용자에게 최종 확인을 받는다.**

배포 후 라이브 URL과 "GA4 실시간으로 유입 확인" 안내로 마무리하라.
