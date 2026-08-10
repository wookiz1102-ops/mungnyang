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
1) keyword-researcher 서브에이전트로 posts/ 와 sitemap.xml 을 확인해 아직 안 다룬 강아지·고양이 주제 하나를 고른다.
2) content-writer 로 .claude/templates/post-template.html 구조에 맞춰 posts/<slug>.html 로 본문을 쓴다.
3) vet-fact-checker 로 건강 내용을 검수·수정한다(YMYL: 단정·용량지시 금지, 병원 방문 기준과 면책 포함).
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
  DRAFT_OUT=$(claude -p "$DRAFT_PROMPT" --permission-mode acceptEdits \
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
  --allowedTools "Bash(node scripts/check-duplication.mjs:*)" "Bash(node scripts/count-body.mjs:*)" "Bash(node scripts/verify-anchors.mjs:*)" \
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
