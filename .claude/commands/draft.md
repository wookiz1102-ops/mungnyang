---
description: 주제 하나로 새 글 초안을 끝까지 자동 생성 (발행/배포는 안 함, drafts/에 저장)
argument-hint: <주제 또는 타깃 키워드>
---

"$ARGUMENTS" 주제로 **댕냥피디아** 새 글 초안을 만든다.
**중요: 절대 발행하거나 배포(git push)하지 않는다.** 결과물은 `drafts/`에만 저장한다.

아래 파이프라인을 순서대로 수행하라(각 단계는 해당 서브에이전트에 위임):

1. **keyword-researcher** — "$ARGUMENTS"의 타깃 키워드·검색의도·제목안·카테고리를 확정한다.
   `posts/`와 `sitemap.xml`을 확인해 **이미 다룬 주제면 중단하고 보고**한다.
2. **content-writer** — `posts/_template.html` 구조로 본문을 작성하되, 저장 위치는 **`drafts/<slug>.html`**
   (slug는 기존 글처럼 영문 케밥, 예: `dog-summer-skin`). `<head>`에 반드시
   `<meta name="robots" content="noindex, nofollow">` 를 넣어 색인을 막는다.
3. **vet-fact-checker** — 건강·의학 내용의 정확성/안전성을 검수하고 필요한 부분을 수정한다.
4. **seo-optimizer** — 제목·메타 설명·H 구조·JSON-LD를 최적화한다.
5. **internal-linker** — 관련글·문맥 링크를 **제안만** 한다. (sitemap·목록 페이지 반영은 발행 단계에서 처리하므로 지금은 건드리지 않는다.)

완료 후 다음을 보고하라:
- 초안 파일 경로, 타깃 키워드, 한 줄 요약
- vet-fact-checker가 지적/수정한 사항
- 로컬 검토 URL: `http://localhost:8642/drafts/<slug>.html`

마지막 줄: **"검토 후 `/publish <slug>` 로 발행하세요."**
