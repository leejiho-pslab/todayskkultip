#!/usr/bin/env bash
# =============================================================
#  멀티 사이트 코드 동기화
#  이 레포(원본)의 "코드"를 위성 사이트 레포들에 밀어넣는다.
#  - 콘텐츠(content/posts)·커버·발굴 주제·요청·수익 기록 등
#    "레포 고유 데이터"는 절대 건드리지 않는다.
#  - 필요 환경변수:
#      SYNC_TOKEN   : fine-grained PAT (대상 레포 Contents/Workflows 쓰기)
#      SYNC_TARGETS : 공백 구분 대상 레포 목록 (예: "owner/repo1 owner/repo2")
# =============================================================
set -euo pipefail

if [ -z "${SYNC_TOKEN:-}" ]; then
  echo "[sync] SYNC_TOKEN 미설정 — 동기화 건너뜀"
  exit 0
fi
if [ -z "${SYNC_TARGETS:-}" ]; then
  echo "[sync] SYNC_TARGETS 미설정 — 동기화 건너뜀"
  exit 0
fi

SRC="$(pwd)"
SHORT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

for repo in $SYNC_TARGETS; do
  echo "=== [sync] $repo ==="
  dir="$(mktemp -d)"
  if ! git clone --depth 1 "https://x-access-token:${SYNC_TOKEN}@github.com/${repo}.git" "$dir" 2>/dev/null; then
    echo "[sync] ⚠ $repo 클론 실패 — 건너뜀 (레포 존재/토큰 권한 확인)"
    continue
  fi

  # ---- 코드 경로 동기화 (대상에서 삭제된 코드 파일도 원본 기준으로 정리) ----
  rsync -a --delete "$SRC/automation/"      "$dir/automation/"
  rsync -a --delete "$SRC/src/styles/"      "$dir/src/styles/"
  rsync -a --delete "$SRC/.github/"         "$dir/.github/"
  rsync -a --delete "$SRC/docs/"            "$dir/docs/"
  rsync -a --delete "$SRC/config/profiles/" "$dir/config/profiles/"
  # 프로필별 브랜드 이미지 (있을 때만, 삭제 없이 추가/갱신)
  if [ -d "$SRC/src/assets/brand" ]; then
    mkdir -p "$dir/src/assets/brand"
    rsync -a "$SRC/src/assets/brand/" "$dir/src/assets/brand/"
  fi
  # 단일 파일들
  cp "$SRC/package.json" "$dir/package.json"
  [ -f "$SRC/package-lock.json" ] && cp "$SRC/package-lock.json" "$dir/package-lock.json"
  cp "$SRC/config/site.config.js"    "$dir/config/site.config.js"
  cp "$SRC/config/geo-checklist.json" "$dir/config/geo-checklist.json"
  # 시즌 주제 풀(코드로 관리) — 발굴 풀(*-generated)은 레포 고유라 제외
  mkdir -p "$dir/config/topics"
  for f in "$SRC"/config/topics/*seasonal-topics.json; do
    cp "$f" "$dir/config/topics/$(basename "$f")"
  done
  # ---- 보존되는 레포 고유 데이터 (건드리지 않음) ----
  #   content/posts/**, src/assets/covers/**, src/assets/(기본 브랜드),
  #   config/topics/*generated-topics.json, config/requests.json, config/revenue.json, CLAUDE.md

  cd "$dir"
  git config user.name "github-actions[bot]"
  git config user.email "github-actions[bot]@users.noreply.github.com"
  git add -A
  if git diff --cached --quiet; then
    echo "[sync] $repo — 변경 없음"
  else
    git commit -m "chore: 사이트 코드 동기화 (원본 leejiho-pslab/site@${SHORT_SHA})"
    if git push; then
      echo "[sync] ✅ $repo 동기화 완료"
    else
      echo "[sync] ⚠ $repo 푸시 실패 — PAT 권한(Contents/Workflows R+W) 확인"
    fi
  fi
  cd "$SRC"
  rm -rf "$dir"
done

echo "[sync] 전체 완료"
