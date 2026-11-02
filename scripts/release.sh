#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
repository="yinzhenCoder/remember-desktop"
version="$(node -p 'require("./package.json").version')"
tag="v$version"
git_auth() {
  git -c "http.proxy=${HTTPS_PROXY:-}" -c credential.helper= \
    -c 'credential.helper=!gh auth git-credential' "$@"
}
if [[ -n "$(git status --porcelain)" ]]; then
  printf 'Working tree has uncommitted changes. Commit them before releasing.\n' >&2
  exit 1
fi
bash scripts/publish.sh
if git show-ref --tags --verify --quiet "refs/tags/$tag"; then
  if [[ "$(git rev-list -n 1 "$tag")" != "$(git rev-parse HEAD)" ]]; then
    printf '%s already points to another commit. Do not overwrite release tags.\n' "$tag" >&2
    exit 1
  fi
else
  git tag -a "$tag" -m "弹幕提醒 $tag"
fi
git_auth push origin "refs/tags/$tag"
printf '\nRelease build queued: https://github.com/%s/actions/workflows/release.yml\n' "$repository"
printf 'Release appears after the Windows build succeeds: https://github.com/%s/releases/tag/%s\n' "$repository" "$tag"
