#!/usr/bin/env bash
# 댕냥피디아 자동 초안 감시
#   - 미니PC의 09:00 자동 초안이 실제로 발행됐는지 GitHub 쪽에서 확인한다.
#   - 미니PC가 꺼져 있거나 claude 가 죽어도 이 스크립트는 GitHub Actions 에서
#     돌기 때문에, "아무 일도 일어나지 않은" 실패(2026-07-29 사례)까지 잡는다.
#   - 이상이 있으면 이슈를 열고(이미 열려 있으면 코멘트), 복구되면 자동으로 닫는다.
#   - DRY_RUN=1 이면 판정과 본문만 출력하고 이슈는 건드리지 않는다.
#
# jq 대신 gh 내장 --jq 만 쓴다 — 별도 설치 없이 로컬에서도 그대로 검증할 수 있다.
set -uo pipefail

REPO=${REPO:?REPO 환경변수가 필요합니다}
OWNER=${OWNER:-}
RUN_URL=${RUN_URL:-}
DRY_RUN=${DRY_RUN:-0}

TODAY=$(TZ=Asia/Seoul date +%Y%m%d)
NOW=$(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M')
LABEL=auto-draft-alert
FIELDS=number,state,headRefName,url,createdAt,title

# ── A. 오늘 초안은 발행됐는가 ──────────────────────────────────────────
TODAY_STATE=$(gh pr list --repo "$REPO" --state all --limit 60 --json "$FIELDS" \
  --jq 'map(select(.headRefName | startswith("draft/'"$TODAY"'"))) | (.[0].state // "NONE")')
TODAY_URL=$(gh pr list --repo "$REPO" --state all --limit 60 --json "$FIELDS" \
  --jq 'map(select(.headRefName | startswith("draft/'"$TODAY"'"))) | (.[0].url // "")')

# ── B. 머지되지 않고 방치된 초안 PR (2시간 이상 열려 있는 것, 오늘 것 제외) ──
STALE=$(gh pr list --repo "$REPO" --state open --limit 60 --json "$FIELDS" \
  --jq 'map(select((.headRefName | startswith("draft/"))
                   and ((.headRefName | startswith("draft/'"$TODAY"'")) | not)
                   and ((now - (.createdAt | fromdateiso8601)) > 7200)))
        | map("- [#\(.number) \(.title)](\(.url)) — \(((now - (.createdAt | fromdateiso8601)) / 86400) | floor)일째 열려 있음")
        | join("\n")')

echo "오늘($TODAY) 초안 상태: $TODAY_STATE"
echo "방치된 초안 PR: ${STALE:-없음}"

BODY=$(mktemp)
trap 'rm -f "$BODY"' EXIT

{
  echo "점검 시각: $NOW KST"
  if [ -n "$RUN_URL" ]; then echo; echo "[점검 실행 로그]($RUN_URL)"; fi
  echo
} > "$BODY"

PROBLEM=0

case "$TODAY_STATE" in
  MERGED)
    ;;
  NONE)
    PROBLEM=1
    cat >> "$BODY" <<EOF
### 🚨 오늘($TODAY) 초안이 아예 만들어지지 않았습니다

\`draft/$TODAY-*\` 브랜치도 PR도 없습니다. 글을 쓰기 전 단계에서 멈춘 것입니다.

확인 순서
1. 미니PC 전원·절전 상태, 작업 스케줄러의 \`LastRunTime\` / \`LastTaskResult\`
2. \`C:\srv\draft-log.txt\` 의 오늘 구간 — \`claude -p\` 오류 메시지
3. 클로드 사용량 한도 (미니PC와 데스크톱이 같은 구독을 공유합니다)
4. \`gh auth status\` — 토큰 만료 여부

EOF
    ;;
  OPEN)
    PROBLEM=1
    cat >> "$BODY" <<EOF
### ⚠️ 오늘($TODAY) 초안이 머지되지 않았습니다

초안은 만들어졌지만 자동 발행이 보류됐습니다 — publish-reviewer FAIL 판정이거나 머지 충돌입니다.
사유는 PR 코멘트에 있습니다: $TODAY_URL

검토해서 고친 뒤 머지하거나, 폐기할 거면 PR 을 닫아 주세요.

EOF
    ;;
  *)
    PROBLEM=1
    cat >> "$BODY" <<EOF
### ⚠️ 오늘($TODAY) 초안 PR 이 머지되지 않고 닫혔습니다

$TODAY_URL — 의도한 것이면 무시하세요.

EOF
    ;;
esac

if [ -n "$STALE" ]; then
  PROBLEM=1
  cat >> "$BODY" <<EOF
### 📌 방치된 초안 PR

자동 머지되지 않고 열린 채 남아 있습니다. 이대로 두면 그날 글이 조용히 사라집니다.

$STALE

EOF
fi

cat >> "$BODY" <<EOF
---
매일 12:00 KST 자동 점검이 엽니다. 정상 복구되면 다음 점검에서 자동으로 닫힙니다.
EOF

if [ "$DRY_RUN" = "1" ]; then
  echo "=== DRY RUN — 이슈를 만들지 않습니다 (PROBLEM=$PROBLEM) ==="
  cat "$BODY"
  exit 0
fi

gh label create "$LABEL" --repo "$REPO" --color B60205 \
  --description "자동 초안 파이프라인 이상" >/dev/null 2>&1 || true

EXISTING=$(gh issue list --repo "$REPO" --state open --label "$LABEL" \
             --limit 1 --json number --jq '.[0].number // empty')

if [ "$PROBLEM" = "1" ]; then
  if [ -n "$EXISTING" ]; then
    gh issue comment "$EXISTING" --repo "$REPO" --body-file "$BODY"
    echo "기존 이슈 #$EXISTING 에 코멘트 추가"
  elif [ -n "$OWNER" ]; then
    gh issue create --repo "$REPO" --label "$LABEL" --assignee "$OWNER" \
      --title "⚠️ 자동 초안 이상 ($TODAY)" --body-file "$BODY"
  else
    gh issue create --repo "$REPO" --label "$LABEL" \
      --title "⚠️ 자동 초안 이상 ($TODAY)" --body-file "$BODY"
  fi
else
  echo "이상 없음 — 오늘 초안 머지 완료, 방치된 초안 PR 없음"
  if [ -n "$EXISTING" ]; then
    gh issue close "$EXISTING" --repo "$REPO" \
      --comment "✅ 복구 확인 ($NOW KST) — 오늘 초안이 정상 발행됐고 방치된 초안 PR 도 없습니다."
  fi
fi
