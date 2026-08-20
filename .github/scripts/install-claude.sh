#!/usr/bin/env bash
# Claude Code CLI 설치.
#
# 플랫폼 네이티브 바이너리는 npm optional dependency 로 들어오는데,
# optional 은 받아오지 못해도 npm 이 조용히 성공 처리한다. 실제로 2026-08-20 에
# "added 1 package"(정상은 2개)로 끝나 래퍼만 깔렸고, 실행 시에야
# "claude native binary not installed" 로 드러났다.
#
# 그래서 설치했다고 믿지 않고 실행 가능한지 확인한다. 안 되면 postinstall 을
# 직접 돌리고, 그래도 안 되면 지우고 다시 설치한다.
set -uo pipefail

PKG="@anthropic-ai/claude-code"
ready() { claude --version >/dev/null 2>&1; }

for attempt in 1 2 3; do
  echo "--- 설치 시도 $attempt/3 ---"
  npm install -g "$PKG"

  if ready; then
    echo "✅ $(claude --version)"
    exit 0
  fi

  echo "네이티브 바이너리 없음 — postinstall 을 직접 실행합니다"
  root=$(npm root -g 2>/dev/null || echo "")
  if [ -n "$root" ] && [ -f "$root/$PKG/install.cjs" ]; then
    node "$root/$PKG/install.cjs" || true
    if ready; then
      echo "✅ $(claude --version) — postinstall 로 복구"
      exit 0
    fi
  else
    echo "install.cjs 를 찾지 못했습니다: $root/$PKG/"
  fi

  if [ "$attempt" -lt 3 ]; then
    echo "지우고 다시 설치합니다"
    npm uninstall -g "$PKG" >/dev/null 2>&1 || true
    sleep 5
  fi
done

echo "❌ Claude Code 설치 실패 — 3회 시도 모두 네이티브 바이너리 없음"
claude --version || true
exit 1
