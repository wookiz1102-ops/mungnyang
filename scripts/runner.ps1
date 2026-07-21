param([switch]$DryRun)
# 댕냥피디아 자동 초안 러너 (저장소 관리 버전)
#   - 실행기(C:\srv\weekly-draft.ps1)가 main 을 최신화한 뒤 이 스크립트를 호출한다.
#   - 로그(C:\srv\draft-log.txt)는 실행기의 Start-Transcript 가 담당한다(여기서는 안 함).
#   - -DryRun: 생성/PR/머지 없이 "제대로 호출돼 돌아가는지"만 확인하고 즉시 종료.
$ErrorActionPreference = "Stop"

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
$stamp  = Get-Date -Format "yyyyMMdd-HHmm"
$branch = "draft/$stamp"
git checkout -b $branch
$prompt = @'
댕냥피디아 새 블로그 글 1편을 "발행 가능한 완성 상태"로 만들어 이 브랜치에 준비하라. main에 직접 push하지 마라.
‼ 이 실행은 자동 발행 파이프라인의 일부다. /draft·/publish 같은 슬래시 명령(스킬)을 절대 호출하지 마라 —
  그 명령들은 결과물을 git이 무시하는 drafts/ 폴더에 저장하고 noindex를 붙여 발행을 막는다(그래서 이 작업이 조용히 실패한다).
  반드시 아래 단계를 서브에이전트로 직접 수행하고, 완성본은 git이 추적하는 posts/<slug>.html 에 써라(drafts/ 아님, noindex 넣지 마라).
1) keyword-researcher 서브에이전트로 posts/ 와 sitemap.xml 을 확인해 아직 안 다룬 강아지·고양이 주제 하나를 고른다.
2) content-writer 로 posts/_template.html 구조에 맞춰 posts/<slug>.html 로 본문을 쓴다.
3) vet-fact-checker 로 건강 내용을 검수·수정한다(YMYL: 단정·용량지시 금지, 병원 방문 기준과 면책 포함).
4) seo-optimizer 로 제목·메타·JSON-LD를 최적화한다.
5) internal-linker 로 sitemap.xml·해당 카테고리 목록·index.html 최신글·js/search-data.js·(관련시)js/breed-data.js·본문 .related 에 반영한다(품종=엄선링크, 카테고리=본진 원칙 유지).
파일 편집만 하고 git 커밋/푸시는 하지 마라(스크립트가 처리한다).
'@
claude -p $prompt --permission-mode acceptEdits --disallowedTools "Bash(git:*)" "Skill"
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
  $reviewOut = claude -p $reviewPrompt --permission-mode acceptEdits `
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
    Set-Content -Path $tmp -Encoding utf8 -Value @(
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
      Set-Content -Path $tmp -Encoding utf8 -Value @(
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
    Set-Content -Path $tmp -Encoding utf8 -Value @(
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
}
