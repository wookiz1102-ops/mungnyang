param([switch]$DryRun)
# 댕냥피디아 자동 초안 러너 (저장소 관리 버전)
#   - 실행기(C:\srv\weekly-draft.ps1)가 main 을 최신화한 뒤 이 스크립트를 호출한다.
#   - 로그(C:\srv\draft-log.txt)는 실행기의 Start-Transcript 가 담당한다(여기서는 안 함).
#   - -DryRun: 생성/PR/머지 없이 "제대로 호출돼 돌아가는지"만 확인하고 즉시 종료.
$ErrorActionPreference = "Stop"

# claude 는 UTF-8 로 출력하는데 PowerShell 은 콘솔 코드페이지(한국어 Windows 기본 cp949)로
# 디코딩해, 검토 출력의 한글이 "## 諛쒗뻾 ??理쒖쥌" 처럼 깨진 채 PR 코멘트에 올라갔다.
# 읽을 수 없는 FAIL 사유는 게이트를 무력화하므로 캡처 인코딩을 UTF-8 로 고정한다.
# (콘솔이 없는 환경에서는 setter 가 예외를 던질 수 있어 감싼다)
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }
$OutputEncoding = [System.Text.Encoding]::UTF8

# PS 5.1 의 Set-Content -Encoding utf8 은 BOM(EF BB BF)을 붙인다. 그 파일을 gh --body-file 로
# 넘기면 첫 줄이 "﻿## 제목" 이 되어 마크다운 heading 으로 렌더되지 않는다. BOM 없이 쓴다.
function Write-Utf8NoBom {
  param([string]$Path, [string[]]$Lines)
  [System.IO.File]::WriteAllText($Path, ($Lines -join "`r`n"), (New-Object System.Text.UTF8Encoding $false))
}

# 검토 출력에서 마지막 VERDICT 줄을 찾아 PASS/FAIL 을 돌려준다.
# 찾지 못하거나 PASS/FAIL 이 아니면 $null (호출부에서 FAIL 로 처리 — 안전 우선).
function Get-Verdict {
  param([string[]]$Lines)
  $verdict = $null
  foreach ($line in $Lines) {
    if ($line -match '^\s*VERDICT:\s*(PASS|FAIL)\s*$') { $verdict = $Matches[1] }
  }
  return $verdict
}

# 실패를 로그에만 남기면 아무도 모른 채 그날 글이 사라진다(2026-07-24·07-29 사례) — 이슈로 알린다.
# 이슈는 .github/workflows/draft-watchdog.yml 의 일일 점검이 복구 확인 후 자동으로 닫는다.
function New-FailureIssue {
  param([string]$Stamp, [string]$Reason, [string]$Detail = "")
  $tmp = Join-Path $env:TEMP "draft-fail-$Stamp.md"
  $lines = @(
    "## 🚨 자동 초안 실패 — $Stamp",
    "",
    $Reason,
    "",
    "PR 이 만들어지지 않았으므로 오늘 글은 발행되지 않았습니다."
  )
  # 실제 오류 출력을 함께 싣는다. 이게 없으면 미니PC 로그를 직접 열어야만
  # 원인을 알 수 있어, 알림을 받고도 사람이 그 기계 앞에 가야 한다.
  if ($Detail) {
    $tail = ($Detail -split "`r?`n" | Select-Object -Last 60) -join "`n"
    $lines += @("", "<details><summary>claude 출력 (마지막 60줄)</summary>", "", '```', $tail, '```', "", "</details>")
  }
  # 복구 방법을 맨 앞에 둔다. 미니PC 로그 위치를 먼저 보여주면 그 기계로 가야 하는
  # 것처럼 읽히는데, 실제로는 데스크톱에서 대신 글을 써서 채우는 편이 훨씬 빠르다.
  $lines += @(
    "",
    "### 복구 방법",
    "",
    "데스크톱 클로드에 **""자동 초안 실패했어""** 라고만 알려주세요.",
    "위 오류 출력으로 원인을 판별하고, 필요하면 그날 글을 대신 작성해 발행합니다.",
    "**미니PC 를 직접 열 필요는 없습니다.**",
    "",
    "<details><summary>미니PC 에서 확인할 곳 (설정 변경이 필요할 때만)</summary>",
    "",
    "- ``C:\srv\draft-log.txt`` 의 ``$Stamp`` 구간 (전체 출력)",
    "- Claude Code 자동 업데이트 충돌 (``claude --version`` 이 바로 응답하는지)",
    "- 클로드 사용량 한도 / ``gh auth status``",
    "",
    "</details>"
  )
  Write-Utf8NoBom -Path $tmp -Lines $lines
  # 같은 사고에 이슈가 두 개 열리지 않게 한다. 감시 워크플로가 12:00 에 먼저 이슈를 열고
  # 러너가 15:00 에 또 여는 일이 있었다(2026-08-10, #77·#78). 감시 쪽에 있는 중복 방지가
  # 여기에는 없었다. 열려 있는 알림 이슈가 있으면 코멘트로 붙인다.
  # 알림 실패가 본 작업을 죽이지 않도록 전체를 감싼다.
  try {
    $existing = gh issue list --state open --label "auto-draft-alert" --limit 1 --json number --jq ".[0].number // empty"
    if ($existing) {
      gh issue comment $existing --body-file $tmp
      Write-Host "기존 알림 이슈 #$existing 에 코멘트 추가"
    } else {
      gh issue create --title "🚨 자동 초안 실패 ($Stamp)" --body-file $tmp --label "auto-draft-alert"
    }
  } catch { Write-Host "이슈 알림 실패: $($_.Exception.Message)" }
  Remove-Item $tmp -ErrorAction SilentlyContinue
}

# 이 스크립트는 저장소의 scripts\ 안에 있으므로, 부모 폴더가 곧 저장소 루트다.
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

if ($DryRun) {
  Write-Host "=== DRY RUN: runner.ps1 정상 호출됨 ($(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')) ==="
  Write-Host "repo   : $repo"
  Write-Host ("git    : " + (Get-Command git    -ErrorAction SilentlyContinue).Source)
  Write-Host ("claude : " + (Get-Command claude -ErrorAction SilentlyContinue).Source)
  Write-Host ("gh     : " + (Get-Command gh     -ErrorAction SilentlyContinue).Source)
  Write-Host ("현재 브랜치: " + (git rev-parse --abbrev-ref HEAD))
  Write-Host "생성(claude -p)·PR·머지 단계는 건너뜀 — 플러밍 확인만 완료."
  return
}

git checkout main
git pull --ff-only origin main

# ── claude 실행기 준비 확인 (재발 방지) ──────────────────────────────
# 2026-07-29: 자동 업데이트가 265MB claude.exe 를 교체하는 중에 09:00 작업이 실행돼
# "'claude.exe' 프로그램을 실행하지 못했습니다 / 인덱스가 배열 범위를 벗어났습니다"로 즉시 실패했다.
# ① 이 작업 동안은 claude 자동 업데이트를 끄고(충돌 방지),
# ② 준비될 때까지 재시도한 뒤에야 브랜치를 만든다(실패 시 dangling 브랜치·헛 PR 방지).
$stamp = Get-Date -Format "yyyyMMdd-HHmm"   # 실패 알림에서도 쓰므로 준비 확인보다 먼저 잡는다
$env:DISABLE_AUTOUPDATER = "1"
$claudeReady = $false
for ($i = 1; $i -le 5; $i++) {
  try { $null = & claude --version 2>&1; if ($LASTEXITCODE -eq 0) { $claudeReady = $true; break } } catch { }
  Write-Host "claude 실행기 준비 안 됨(시도 $i/5) — 업데이트 중일 수 있음. 60초 후 재시도."
  Start-Sleep -Seconds 60
}
if (-not $claudeReady) {
  Write-Host "claude 실행기를 5회 재시도 후에도 실행 불가 — 자동 업데이트 충돌 가능. 브랜치/PR 생성 없이 중단(다음 스케줄에 재시도)."
  New-FailureIssue -Stamp $stamp -Reason ("``claude --version`` 이 5회(약 5분) 재시도 후에도 응답하지 않아 초안 생성을 시작하지 못했습니다. " +
    "자동 업데이트가 실행기를 교체 중이었을 가능성이 큽니다.")
  return
}

$branch = "draft/$stamp"
git checkout -b $branch
$prompt = @'
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
'@
# 초안 생성. 실패해도 스크립트가 여기서 죽지 않게 잡는다
# (죽으면 실패 알림조차 못 보내고 조용히 끝난다 — 2026-07-29 사례).
#
# 한 번 실패했다고 그날을 버리지 않는다. 종료 코드 1 의 흔한 원인(사용량 한도,
# 일시적 오류)은 몇 시간이면 풀리므로 같은 날 안에서 다시 시도한다
# — 09:00 → 12:00 → 15:00. 사람을 부르는 건 세 번 다 실패한 뒤다(2026-08-09 사례).
$maxAttempts = 3
$retryDelay  = 10800   # 3시간
$claudeFailed = $false
$claudeError  = ""
$claudeOutput = ""

for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
  $claudeFailed = $false
  # 네이티브 stderr 를 받으려면 Stop 을 잠시 풀어야 한다
  # ($ErrorActionPreference="Stop" 에서는 stderr 한 줄에 NativeCommandError 가 난다).
  $prevEAP = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $raw = claude -p $prompt --permission-mode acceptEdits --disallowedTools "Bash(git:*)" "Skill" 2>&1
    $claudeOutput = ($raw | Out-String)
    Write-Host $claudeOutput
    if ($LASTEXITCODE -ne 0) { $claudeFailed = $true; $claudeError = "종료 코드 $LASTEXITCODE" }
  } catch {
    $claudeFailed = $true
    $claudeError  = $_.Exception.Message
    $claudeOutput = ($_ | Out-String)
  } finally {
    $ErrorActionPreference = $prevEAP
  }

  # 뭐라도 만들었으면 검토 단계로 넘긴다 — 완성도 판단은 publish-reviewer 몫이다.
  if (git status --porcelain) { break }

  if ($attempt -lt $maxAttempts) {
    Write-Host "초안 생성 실패($attempt/$maxAttempts) — $claudeError. $($retryDelay/3600)시간 후 재시도."
    Start-Sleep -Seconds $retryDelay
  } else {
    Write-Host "초안 생성 $maxAttempts 회 모두 실패 — $claudeError"
  }
}
if (git status --porcelain) {
  git add -A
  git commit -m "자동 초안 ($stamp)`n`nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  git push -u origin $branch
  gh pr create --base main --head $branch --title "초안 검토: $stamp" --body "자동 생성된 초안입니다. 검토 후 머지하면 발행됩니다."

  # ---- AI 검토 후 자동 발행 ----
  $reviewPrompt = @'
publish-reviewer 서브에이전트로 현재 브랜치의 발행 전 최종 검토를 수행하라.
검토 대상은 `git diff origin/main...HEAD` 의 전체 변경사항이다.
publish-reviewer 의 검토 결과를 요약하거나 가공하지 말고 그대로 최종 출력으로 내보내라.
마지막 줄은 반드시 "VERDICT: PASS" 또는 "VERDICT: FAIL" 이어야 한다.
git 커밋/푸시/머지와 PR 조작은 하지 마라 — 스크립트가 처리한다.
'@
  # publish-reviewer 가 필수 게이트(중복/분량/앵커 검사)를 비대화식에서 실행할 수 있게 명시 허용한다.
  # (리포 .claude/settings.json 의 allow 는 "workspace 미신뢰" 상태에선 무시되므로, CLI 플래그로 직접 허용 — 2026-07-30 확인)
  $reviewOut = claude -p $reviewPrompt --permission-mode acceptEdits `
                 --allowedTools "Bash(node scripts/check-duplication.mjs:*)" "Bash(node scripts/count-body.mjs:*)" "Bash(node scripts/verify-anchors.mjs:*)" "Bash(node scripts/verify-faq-match.mjs:*)" `
                 --disallowedTools "Bash(git commit:*)" "Bash(git push:*)" "Bash(git merge:*)" "Bash(gh:*)" "Skill"
  $reviewText = ($reviewOut | Out-String).Trim()
  Write-Host $reviewText

  # 검토 중 publish-reviewer 가 경미한 수정을 했을 수 있으므로 머지 전에 반영한다.
  if (git status --porcelain) {
    git add -A
    git commit -m "검토 중 수정 ($stamp)`n`nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
    git push origin $branch
  }

  $verdict = Get-Verdict $reviewOut
  $tmp = Join-Path $env:TEMP "review-$stamp.md"

  if ($verdict -eq "PASS") {
    # 머지 후에도 PR 에 검토 기록이 남도록, 머지 전에 검토 출력 전체를 코멘트로 남긴다.
    Write-Utf8NoBom -Path $tmp -Lines @(
      "## 자동 발행 승인 — publish-reviewer 가 PASS 판정",
      "",
      "<details><summary>publish-reviewer 검토 출력 전체</summary>",
      "",
      '```',
      $reviewText,
      '```',
      "",
      "</details>"
    )
    gh pr comment $branch --body-file $tmp

    git checkout main   # --delete-branch 가 로컬 브랜치도 지울 수 있도록 벗어난다
    gh pr merge $branch --merge --delete-branch
    if ($LASTEXITCODE -ne 0) {
      Write-Utf8NoBom -Path $tmp -Lines @(
        "## 자동 머지 실패 — 수동 확인 필요",
        "",
        "publish-reviewer 는 ``VERDICT: PASS`` 를 냈지만 자동 머지가 실패했습니다(충돌 등).",
        "충돌을 해소한 뒤 수동으로 머지해 주세요. PR 은 열어 둡니다."
      )
      gh pr comment $branch --body-file $tmp
      Write-Host "자동 머지 실패 — PR 을 열어 둠"
    } else {
      Write-Host "발행 완료 — $branch 머지됨"
    }
  } else {
    $reason = if ($verdict -eq "FAIL") { "publish-reviewer 가 FAIL 판정" }
              else { "VERDICT 줄을 찾지 못함 (안전 우선 FAIL 처리)" }
    Write-Utf8NoBom -Path $tmp -Lines @(
      "## 자동 발행 보류 — $reason",
      "",
      "사람 검토 후 수동 머지가 필요합니다.",
      "",
      "<details><summary>publish-reviewer 검토 출력 전체</summary>",
      "",
      '```',
      $reviewText,
      '```',
      "",
      "</details>"
    )
    gh pr comment $branch --body-file $tmp
    Write-Host "발행 보류 ($reason) — PR 을 열어 둠"
  }

  Remove-Item $tmp -ErrorAction SilentlyContinue
} else {
  Write-Host "변경 없음 — posts/ 에 커밋할 변경이 없음. 초안이 posts/ 대신 drafts/ 로 샜는지(예: /draft 명령 호출) 또는 중복 주제로 중단됐는지 확인 필요."
  if (Test-Path "$repo\drafts") {
    Write-Host "drafts/ (git 무시 폴더) 내용:"
    Get-ChildItem "$repo\drafts" | ForEach-Object { Write-Host ("  - {0} ({1} bytes, {2})" -f $_.Name, $_.Length, $_.LastWriteTime) }
  }

  $why = if ($claudeFailed) { "``claude -p`` 가 비정상 종료했습니다 — $claudeError" }
         else { "``claude -p`` 는 끝났지만 커밋할 변경이 없습니다. 초안이 ``drafts/`` 로 샜거나 주제 선정 단계에서 중단된 경우입니다." }
  $why = "$why`n`n$maxAttempts 회 시도(약 $(($maxAttempts - 1) * $retryDelay / 3600)시간 간격) 모두 실패했습니다."
  New-FailureIssue -Stamp $stamp -Reason $why -Detail $claudeOutput

  # 커밋 없는 빈 브랜치 정리. 실패해도 다음 실행의 checkout -f main 이 회복하므로 무시한다.
  # ($ErrorActionPreference="Stop" 에서 네이티브 stderr 리다이렉트는 NativeCommandError 를 유발할 수 있어 쓰지 않는다)
  git checkout main
  try { git branch -D $branch } catch { }
}
