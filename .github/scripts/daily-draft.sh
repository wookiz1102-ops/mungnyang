#!/usr/bin/env bash
# 댕냥피디아 자동 초안 — GitHub Actions 판
#   scripts/runner.ps1 (미니PC 판)을 그대로 옮긴 것이다. 프롬프트·게이트·머지 판정 로직은
#   동일하게 두고 실행 환경만 바꾼다. 미니PC 판에만 있던 것들은 여기서 불필요해 뺐다.
#     - claude 자동 업데이트 충돌 방지: 매 실행 새로 설치하므로 해당 없음
#     - 콘솔 인코딩(cp949) 보정, BOM 없는 파일 쓰기: 리눅스는 UTF-8 기본
#     - 3시간 간격 재시도: 잡 실행 시간을 6시간 잡아먹으므로 짧게 바꿈
#   DRY_RUN=1 이면 플러밍만 확인하고 생성·PR·머지는 건너뛴다.
set -uo pipefail

REPO=${REPO:?REPO 필요}
DRY_RUN=${DRY_RUN:-0}
RUN_URL=${RUN_URL:-}
LABEL=auto-draft-alert
STAMP=$(TZ=Asia/Seoul date +%Y%m%d-%H%M)
BRANCH="draft/$STAMP"

# ── 실패 알림 ────────────────────────────────────────────────────────
# 로그에만 남기면 아무도 모른 채 그날 글이 사라진다. 이슈로 알린다.
# 열린 알림 이슈가 있으면 코멘트로 붙인다(감시 워크플로와 중복 생성 방지).
notify_failure() {
  local reason="$1" detail="${2:-}"
  local body; body=$(mktemp)
  {
    echo "## 🚨 자동 초안 실패 — $STAMP"
    echo
    echo "$reason"
    echo
    echo "PR 이 만들어지지 않았으므로 오늘 글은 발행되지 않았습니다."
    if [ -n "$detail" ]; then
      echo
      echo "<details><summary>claude 출력 (마지막 60줄)</summary>"
      echo
      echo '```'
      echo "$detail" | tail -60
      echo '```'
      echo
      echo "</details>"
    fi
    echo
    echo "### 복구 방법"
    echo
    echo "데스크톱 클로드에 **\"자동 초안 실패했어\"** 라고만 알려주세요."
    echo "위 오류 출력으로 원인을 판별하고, 필요하면 그날 글을 대신 작성해 발행합니다."
    if [ -n "$RUN_URL" ]; then echo; echo "[실행 로그 전체]($RUN_URL)"; fi
  } > "$body"

  gh label create "$LABEL" --repo "$REPO" --color B60205 \
    --description "자동 초안 파이프라인 이상" >/dev/null 2>&1 || true
  local existing
  existing=$(gh issue list --repo "$REPO" --state open --label "$LABEL" \
               --limit 1 --json number --jq '.[0].number // empty' 2>/dev/null || echo "")
  if [ -n "$existing" ]; then
    gh issue comment "$existing" --repo "$REPO" --body-file "$body" && echo "기존 이슈 #$existing 에 코멘트"
  else
    gh issue create --repo "$REPO" --label "$LABEL" \
      --title "🚨 자동 초안 실패 ($STAMP)" --body-file "$body"
  fi
  rm -f "$body"
}

echo "=== 자동 초안 $STAMP ==="
claude --version || { notify_failure "\`claude\` 실행기가 응답하지 않습니다. 설치 단계를 확인하세요."; exit 1; }

if [ "$DRY_RUN" = "1" ]; then
  echo "DRY RUN — 플러밍 확인만 하고 종료합니다."
  git --version; gh --version | head -1; node --version
  echo "현재 브랜치: $(git rev-parse --abbrev-ref HEAD)"
  # 토큰 자체는 GitHub 이 로그에서 가리므로, 값 대신 형태만 확인한다.
  # 401 이 날 때 "잘렸는가 / 공백이 섞였는가 / 아예 비었는가"를 가리는 용도.
  tok=${CLAUDE_CODE_OAUTH_TOKEN:-}
  if [ -z "$tok" ]; then
    echo "토큰: ❌ 비어 있음 — 시크릿이 전달되지 않았습니다"
  else
    echo "토큰: 길이 ${#tok}자"
    case "$tok" in
      *[[:space:]]*) echo "       ⚠️ 공백 또는 줄바꿈이 포함돼 있습니다 (복사 중 딸려온 경우)" ;;
      *)             echo "       공백 없음" ;;
    esac
    # 값은 찍지 않고 "알려진 자격증명 중 무엇인가"만 판별한다.
    # 자리를 잘못 넣은 경우(예: Console API 키)를 값 노출 없이 가리기 위한 것.
    case "$tok" in
      sk-ant-oat*)        echo "       종류: setup-token OAuth 토큰 — 이 자리에 맞음" ;;
      sk-ant-api*)        echo "       종류: ⚠️ Console API 키 — ANTHROPIC_API_KEY 자리에 넣어야 함 (별도 과금)" ;;
      sk-ant-*)           echo "       종류: ⚠️ 기타 sk-ant- 자격증명" ;;
      ghp_*|github_pat_*) echo "       종류: ⚠️ GitHub 토큰 — 전혀 다른 자격증명" ;;
      *)                  echo "       종류: ⚠️ sk-ant- 로 시작하지 않음 (setup-token 출력이 아닐 수 있음)" ;;
    esac
  fi
  # 인증만 따로 시험한다. 초안 생성까지 돌리면 5분 넘게 걸리는데,
  # 401 인지 아닌지는 한 줄이면 판가름난다.
  echo "--- 인증 시험 (claude -p) ---"
  if out=$(claude -p "핑 이라고 하면 퐁 이라고만 답해라" 2>&1); then
    echo "✅ 인증 성공 — 응답: $out"
  else
    echo "❌ 인증 실패 (종료 코드 $?)"
    echo "$out"
  fi
  exit 0
fi

git config user.name  "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git checkout -b "$BRANCH"

DRAFT_PROMPT=$(cat <<'EOF'
댕냥피디아 새 블로그 글 1편을 "발행 가능한 완성 상태"로 만들어 이 브랜치에 준비하라. main에 직접 push하지 마라.
‼ 이 실행은 자동 발행 파이프라인의 일부다. /draft·/publish 같은 슬래시 명령(스킬)을 절대 호출하지 마라 —
  그 명령들은 결과물을 git이 무시하는 drafts/ 폴더에 저장하고 noindex를 붙여 발행을 막는다(그래서 이 작업이 조용히 실패한다).
  반드시 아래 단계를 서브에이전트로 직접 수행하고, 완성본은 git이 추적하는 posts/<slug>.html 에 써라(drafts/ 아님, noindex 넣지 마라).
1) keyword-researcher 서브에이전트로 주제를 고른다. posts/ 와 sitemap.xml 로 중복을 피하고,
   **WebSearch 로 그 주제의 현재 한국어 상위 문서를 실제로 읽어라.** 거기 없는 것을 찾는 게 목적이다.
   주제를 정했으면 반드시 `node scripts/check-topic.mjs <슬러그>` 를 실행하라.
   종료 코드 1이면 다른 주제로 바꾸고, 2면 그 종에만 해당하는 각도 3가지를 대지 못하는 한 다른 주제로 바꿔라.
   ‼ "이 글에만 있을 사실" 3개와 각각의 근거 URL 을 못 대면 **그 주제로 쓰지 말고 다른 주제를 골라라.**
     그래도 못 찾으면 오늘은 글을 쓰지 않는다 — 빈손으로 끝내는 것이 정상 동작이다.
     쓸모없는 글 한 편이 사이트 전체 평가를 깎는다(2026-08 애드센스 2차 거절의 원인).
2) content-writer 로 .claude/templates/post-template.html 구조에 맞춰 posts/<slug>.html 로 본문을 쓴다.
   **WebFetch 로 1차 자료를 직접 열어 확인한 것만 인용한다.** 열어보지 않은 URL 을 적으면 환각 링크이고,
   출처가 없는 것보다 나쁘다. 건강 글은 외부 1차 출처 2개 이상을 본문에 인라인으로 걸고
   하단 `📚 참고한 자료` 에 확인일과 함께 정리한다(포맷은 posts/cat-diarrhea.html 하단 참조).
   `<!-- NOVELTY -->` 블록에 1)에서 정한 사실 3개를 근거 URL·확인일과 함께 적는다.
3) vet-fact-checker 로 건강 내용을 검수·수정한다(YMYL: 자가 투약·용량지시 금지, 병원 방문 기준과 면책 포함).
   확신이 없으면 지우지 말고 **먼저 1차 출처를 찾아 확인하라.** 확인 실패했을 때만 덜어낸다.
3-1) 발행 전 자가 점검: `node scripts/verify-sources.mjs posts/<slug>.html` 과
   `node scripts/check-external-novelty.mjs posts/<slug>.html` 을 실행해 둘 다 통과시켜라.
   실패한 채로 넘기면 검토관이 어차피 FAIL 한다.
4) seo-optimizer 로 제목·메타·JSON-LD를 최적화한다.
5) internal-linker 로 sitemap.xml·해당 카테고리 목록·index.html 최신글·js/search-data.js·(관련시)js/breed-data.js·본문 .related 에 반영한다(품종=엄선링크, 카테고리=본진 원칙 유지).
파일 편집만 하고 git 커밋/푸시는 하지 마라(스크립트가 처리한다).
EOF
)

# 초안 생성. 일시적 오류를 위해 짧게 재시도한다(미니PC 판의 3시간 간격은
# 잡 실행 시간을 통째로 잡아먹으므로 여기서는 5분으로 줄인다).
ATTEMPTS=2
DELAY=300
DRAFT_OUT=""
for attempt in $(seq 1 $ATTEMPTS); do
  # WebSearch/WebFetch 가 여기 없으면 서브에이전트 frontmatter 에 선언해도 실제로 부여되지 않는다.
  # 2026-08 까지 정확히 그 상태였고(keyword-researcher 는 선언만 하고 못 썼다),
  # 그래서 88편이 전부 외부 자료를 한 번도 안 열어본 채 쓰였다 — 애드센스 거절의 근본 원인이다.
  DRAFT_OUT=$(claude -p "$DRAFT_PROMPT" --permission-mode acceptEdits \
                --allowedTools "WebSearch" "WebFetch" "Bash(node scripts/check-topic.mjs:*)" "Bash(node scripts/check-duplication.mjs:*)" "Bash(node scripts/count-body.mjs:*)" "Bash(node scripts/verify-anchors.mjs:*)" "Bash(node scripts/verify-faq-match.mjs:*)" "Bash(node scripts/verify-sources.mjs:*)" "Bash(node scripts/check-external-novelty.mjs:*)" \
                --disallowedTools "Bash(git:*)" "Skill" 2>&1) && rc=0 || rc=$?
  echo "$DRAFT_OUT"
  [ -n "$(git status --porcelain)" ] && break
  if [ "$attempt" -lt "$ATTEMPTS" ]; then
    echo "초안 생성 실패($attempt/$ATTEMPTS, 종료 코드 $rc) — $((DELAY/60))분 후 재시도"
    sleep $DELAY
  fi
done

if [ -z "$(git status --porcelain)" ]; then
  notify_failure "\`claude -p\` 가 초안을 만들지 못했습니다 (${ATTEMPTS}회 시도)." "$DRAFT_OUT"
  exit 1
fi

git add -A
git commit -m "자동 초안 ($STAMP)"
git push -u origin "$BRANCH"
gh pr create --repo "$REPO" --base main --head "$BRANCH" \
  --title "초안 검토: $STAMP" --body "자동 생성된 초안입니다. 검토 후 머지하면 발행됩니다."

# ── AI 검토 후 자동 발행 ─────────────────────────────────────────────
REVIEW_PROMPT=$(cat <<'EOF'
publish-reviewer 서브에이전트로 현재 브랜치의 발행 전 최종 검토를 수행하라.
검토 대상은 `git diff origin/main...HEAD` 의 전체 변경사항이다.
publish-reviewer 의 검토 결과를 요약하거나 가공하지 말고 그대로 최종 출력으로 내보내라.
마지막 줄은 반드시 "VERDICT: PASS" 또는 "VERDICT: FAIL" 이어야 한다.
git 커밋/푸시/머지와 PR 조작은 하지 마라 — 스크립트가 처리한다.
EOF
)
# publish-reviewer 가 필수 게이트(중복/분량/앵커 검사)를 비대화식에서 실행할 수 있게 명시 허용한다.
REVIEW_OUT=$(claude -p "$REVIEW_PROMPT" --permission-mode acceptEdits \
  --allowedTools "WebFetch" "Bash(node scripts/check-topic.mjs:*)" "Bash(node scripts/check-duplication.mjs:*)" "Bash(node scripts/count-body.mjs:*)" "Bash(node scripts/verify-anchors.mjs:*)" "Bash(node scripts/verify-faq-match.mjs:*)" "Bash(node scripts/verify-sources.mjs:*)" "Bash(node scripts/check-external-novelty.mjs:*)" \
  --disallowedTools "Bash(git commit:*)" "Bash(git push:*)" "Bash(git merge:*)" "Bash(gh:*)" "Skill" 2>&1)
echo "$REVIEW_OUT"

# 검토 중 publish-reviewer 가 경미한 수정을 했을 수 있으므로 머지 전에 반영한다.
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -m "검토 중 수정 ($STAMP)"
  git push origin "$BRANCH"
fi

# 마지막 VERDICT 줄을 찾는다. 없거나 PASS/FAIL 이 아니면 안전 우선 FAIL.
VERDICT=$(echo "$REVIEW_OUT" | grep -oE '^\s*VERDICT:\s*(PASS|FAIL)\s*$' | tail -1 | grep -oE 'PASS|FAIL' || echo "")

CMT=$(mktemp)
if [ "$VERDICT" = "PASS" ]; then
  { echo "## 자동 발행 승인 — publish-reviewer 가 PASS 판정"; echo
    echo "<details><summary>publish-reviewer 검토 출력 전체</summary>"; echo
    echo '```'; echo "$REVIEW_OUT"; echo '```'; echo; echo "</details>"; } > "$CMT"
  gh pr comment "$BRANCH" --repo "$REPO" --body-file "$CMT"
  git checkout main
  if gh pr merge "$BRANCH" --repo "$REPO" --merge --delete-branch; then
    echo "발행 완료 — $BRANCH 머지됨"
  else
    { echo "## 자동 머지 실패 — 수동 확인 필요"; echo
      echo "publish-reviewer 는 \`VERDICT: PASS\` 를 냈지만 자동 머지가 실패했습니다(충돌 등)."
      echo "충돌을 해소한 뒤 수동으로 머지해 주세요. PR 은 열어 둡니다."; } > "$CMT"
    gh pr comment "$BRANCH" --repo "$REPO" --body-file "$CMT"
    echo "자동 머지 실패 — PR 을 열어 둠"
  fi
else
  REASON=$([ "$VERDICT" = "FAIL" ] && echo "publish-reviewer 가 FAIL 판정" || echo "VERDICT 줄을 찾지 못함 (안전 우선 FAIL 처리)")
  { echo "## 자동 발행 보류 — $REASON"; echo
    echo "사람 검토 후 수동 머지가 필요합니다."; echo
    echo "<details><summary>publish-reviewer 검토 출력 전체</summary>"; echo
    echo '```'; echo "$REVIEW_OUT"; echo '```'; echo; echo "</details>"; } > "$CMT"
  gh pr comment "$BRANCH" --repo "$REPO" --body-file "$CMT"
  echo "발행 보류 ($REASON) — PR 을 열어 둠"
fi
rm -f "$CMT"
