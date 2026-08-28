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
GRACE=${GRACE:-7200}   # 초안 생성~검토가 끝날 때까지 봐주는 시간(2시간). 이 안쪽은 "진행 중"으로 본다.

# 하루에 여러 번 돌 수 있으므로(수동 재실행·놓친 스케줄 보충) 최신 PR 하나만 보면
# 먼저 성공한 발행이 나중 실패에 가려진다. 세 가지를 따로 센다.

# ① 오늘 발행 성공 — 오늘자 draft PR 중 머지된 것이 하나라도 있는가
TODAY_MERGED=$(gh pr list --repo "$REPO" --state merged --limit 60 --json "$FIELDS" \
  --jq 'map(select(.headRefName | startswith("draft/'"$TODAY"'"))) | length')

# ② 진행 중 — 오늘자 draft PR 중 아직 유예 시간 안쪽인 것 (검토가 안 끝났을 수 있음)
INFLIGHT=$(gh pr list --repo "$REPO" --state open --limit 60 --json "$FIELDS" \
  --jq 'map(select((.headRefName | startswith("draft/'"$TODAY"'"))
                   and ((now - (.createdAt | fromdateiso8601)) <= '"$GRACE"'))) | length')

# ③ 사람 손이 필요한 것 — 유예 시간을 넘겨 열려 있는 draft PR (날짜 무관)
STALE=$(gh pr list --repo "$REPO" --state open --limit 60 --json "$FIELDS" \
  --jq 'map(select((.headRefName | startswith("draft/"))
                   and ((now - (.createdAt | fromdateiso8601)) > '"$GRACE"')))
        | map((now - (.createdAt | fromdateiso8601)) as $s
              | "- [#\(.number) \(.title)](\(.url)) — "
                + (if $s < 86400 then "\(($s / 3600) | floor)시간째" else "\(($s / 86400) | floor)일째" end)
                + " 열려 있음")
        | join("\n")')

echo "오늘($TODAY) 머지된 초안: ${TODAY_MERGED}건 / 진행 중: ${INFLIGHT}건"
echo "손이 필요한 초안 PR: ${STALE:-없음}"

BODY=$(mktemp)
trap 'rm -f "$BODY"' EXIT

{
  echo "점검 시각: $NOW KST"
  if [ -n "$RUN_URL" ]; then echo; echo "[점검 실행 로그]($RUN_URL)"; fi
  echo
} > "$BODY"

PROBLEM=0

# 오늘 발행이 없고, 진행 중도 아니고, 열린 초안도 없다 → 파이프라인이 아무것도 못 했다.
#
# 이때 흔한 원인이 "스케줄이 아예 안 돈 것"이다. GitHub 예약 실행은 지연·누락이 잦다
# (2026-08-27 은 00:00 UTC 예정이 08:02 에 돌았고, 08-28 은 아예 돌지 않았다).
# 사람을 부르기 전에 한 번 직접 돌려본다. 재실행이 실패하면 그때 알린다.
RETRIGGERED=0
if [ "$TODAY_MERGED" = "0" ] && [ "$INFLIGHT" = "0" ] && [ -z "$STALE" ]; then
  echo "오늘 초안이 없습니다 — daily-draft 재실행을 시도합니다"
  if [ "$DRY_RUN" = "1" ]; then
    echo "  (DRY RUN — 실제로 실행하지 않습니다)"
    RETRIGGERED=1
  elif gh workflow run daily-draft.yml --repo "$REPO" 2>&1; then
    echo "  ✅ 재실행 요청 완료 — 이 실행이 실패하면 러너가 따로 알립니다"
    RETRIGGERED=1
  fi
fi

if [ "$TODAY_MERGED" = "0" ] && [ "$INFLIGHT" = "0" ] && [ -z "$STALE" ] && [ "$RETRIGGERED" = "0" ]; then
  PROBLEM=1
  cat >> "$BODY" <<EOF
### 🚨 오늘($TODAY) 초안이 없고 재실행 요청도 실패했습니다

\`draft/$TODAY-*\` 브랜치도 PR도 없고, 감시가 자동으로 건 재실행마저 실패했습니다.

확인 순서
1. 미니PC 전원·절전 상태, 작업 스케줄러의 \`LastRunTime\` / \`LastTaskResult\`
2. \`C:\srv\draft-log.txt\` 의 오늘 구간 — \`claude -p\` 오류 메시지
3. Claude Code 자동 업데이트 충돌 (\`claude --version\` 이 바로 응답하는지)
4. 클로드 사용량 한도 / \`gh auth status\`

EOF
fi

# 유예 시간을 넘겨 열려 있는 초안 — 검토 FAIL 이거나 머지 충돌이다. 방치하면 그날 글이 사라진다.
if [ -n "$STALE" ]; then
  PROBLEM=1
  cat >> "$BODY" <<EOF
### 📌 사람 확인이 필요한 초안 PR

자동 머지되지 않고 열려 있습니다. publish-reviewer FAIL 판정이거나 머지 충돌입니다 —
사유는 각 PR 코멘트에 있습니다. 고쳐서 머지하거나, 폐기할 거면 닫아 주세요.

$STALE

EOF
  if [ "$TODAY_MERGED" != "0" ]; then
    echo "참고: 오늘자 글은 별도로 ${TODAY_MERGED}건 정상 발행됐습니다." >> "$BODY"
    echo >> "$BODY"
  fi
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

# 중복이 생길 수 있으므로(감시와 러너가 각각 열던 시기가 있었다) 전부 받아 둔다.
# 코멘트는 가장 최근 하나에만 달고, 복구 시에는 열린 것을 모두 닫는다.
OPEN_ALERTS=$(gh issue list --repo "$REPO" --state open --label "$LABEL" \
                --limit 20 --json number --jq '.[].number')
EXISTING=$(echo "$OPEN_ALERTS" | head -1)

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
  echo "이상 없음 — 오늘 초안 발행 완료, 손이 필요한 초안 PR 없음"
  for n in $OPEN_ALERTS; do
    gh issue close "$n" --repo "$REPO" \
      --comment "✅ 복구 확인 ($NOW KST) — 오늘 초안이 정상 발행됐고, 열린 채 방치된 초안 PR 도 없습니다."
    echo "알림 이슈 #$n 닫음"
  done
fi
