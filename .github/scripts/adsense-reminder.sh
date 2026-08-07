#!/usr/bin/env bash
# 애드센스 재검토 요청 리마인더
#   - 2026-08-07 에 "2주 더 축적한 뒤 재요청" 으로 정했다. 그 시점이 되면 이슈로 알린다.
#   - 일일 감시 워크플로에 얹혀 매일 확인하므로, 그날 못 돌아도 다음 실행에서 잡힌다.
#   - 라벨 기준으로 open/closed 전체를 확인해 딱 한 번만 만든다(매일 재생성 방지).
#   - DRY_RUN=1 이면 판정과 본문만 출력한다. TARGET_DATE 로 날짜를 바꿔 시험할 수 있다.
set -uo pipefail

REPO=${REPO:?REPO 환경변수가 필요합니다}
OWNER=${OWNER:-}
DRY_RUN=${DRY_RUN:-0}
TARGET=${TARGET_DATE:-20260821}
LABEL=adsense-recheck

TODAY=$(TZ=Asia/Seoul date +%Y%m%d)

if [ "$TODAY" -lt "$TARGET" ]; then
  echo "애드센스 재요청 예정일 $TARGET — 오늘 $TODAY, 아직 알리지 않음"
  exit 0
fi

POSTS=$(ls posts/*.html 2>/dev/null | wc -l | tr -d ' ')

BODY=$(mktemp)
trap 'rm -f "$BODY"' EXIT
cat > "$BODY" <<EOF
2026-08-07 에 "2주 더 쌓고 재요청" 으로 정한 시점이 됐습니다.
현재 발행글 **${POSTS}편** (2026-07-29 요청 시점 52편 → 08-07 결정 시점 63편).

## 누르기 전에 반드시 확인할 것

[사이트 상세 페이지](https://adsense.google.com/adsense/u/0/pub-7190991508798677/sites/detail/url=daengnyangpedia.com)를 열고
**「검토 요청」 버튼 상태부터** 봅니다.

- 버튼이 잠겨 있거나 "검토 중" 표시 → **이미 심사 대기 중입니다. 아무것도 하지 마세요.**
- "문제를 수정했음을 확인합니다" 체크박스가 비어 있고 버튼이 눌리는 상태 → 대기 중인 검토가 없습니다. 재요청 가능.

진행 중인지 아닌지 구분되는 단서가 이 폼 상태뿐입니다. 2026-08-07 에 이걸로
"07-29 요청이 거절됐거나 제출되지 않았다"를 판단했습니다.

## 요청 방법

체크박스를 체크하고 「검토 요청」을 누릅니다.

## 배경

- 판정 사유: **가치가 별로 없는 콘텐츠** (2026-07-27 최초, 08-07 재확인 시에도 동일)
- 사이트 소유권 ✅ / 지급 프로필 ✅ — 남은 것은 콘텐츠 판정 하나
- 2026-07-27 전면 개선(PR #45: 플레이스홀더 제거, 품종 18편 보강, 중복 해소, 외부 출처 추가)
  으로도, 그 뒤 11편 추가(52→63편)로도 뒤집히지 않았음. 그래서 분량 축적을 택했습니다.

---
이 이슈는 자동으로 한 번만 생성됩니다. 처리 후 닫아 주세요.
EOF

if [ "$DRY_RUN" = "1" ]; then
  echo "=== DRY RUN — 이슈를 만들지 않습니다 (오늘 $TODAY >= 예정일 $TARGET) ==="
  cat "$BODY"
  exit 0
fi

gh label create "$LABEL" --repo "$REPO" --color 0E8A16 \
  --description "애드센스 재검토 요청 알림" >/dev/null 2>&1 || true

# open/closed 를 모두 본다 — 이미 처리해 닫은 이슈를 다시 만들지 않기 위해서다.
EXISTING=$(gh issue list --repo "$REPO" --state all --label "$LABEL" \
             --limit 1 --json number --jq '.[0].number // empty')

if [ -n "$EXISTING" ]; then
  echo "이미 생성됨 (#$EXISTING) — 건너뜀"
  exit 0
fi

if [ -n "$OWNER" ]; then
  gh issue create --repo "$REPO" --label "$LABEL" --assignee "$OWNER" \
    --title "📌 애드센스 재검토 요청할 시점 (${POSTS}편)" --body-file "$BODY"
else
  gh issue create --repo "$REPO" --label "$LABEL" \
    --title "📌 애드센스 재검토 요청할 시점 (${POSTS}편)" --body-file "$BODY"
fi
