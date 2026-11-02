#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
repository="yinzhenCoder/remember-desktop"

# Use the current user's secure gh login. Never write tokens to project files.
git_auth() {
  git -c "http.proxy=${HTTPS_PROXY:-}" -c credential.helper= \
    -c 'credential.helper=!gh auth git-credential' "$@"
}

gh auth status -h github.com
git_auth push -u origin main

if gh api "repos/$repository/pages" --silent 2>/dev/null; then
  gh api "repos/$repository/pages" --method PUT -f build_type=workflow --silent
else
  gh api "repos/$repository/pages" --method POST -f build_type=workflow --silent
fi
gh repo edit "$repository" --enable-wiki

wiki_url="https://github.com/$repository.wiki.git"
if git_auth ls-remote "$wiki_url" >/dev/null 2>&1; then
  wiki_directory=".cache/wiki-publish"
  mkdir -p .cache
  if [[ -d "$wiki_directory/.git" ]]; then
    git_auth -C "$wiki_directory" pull --ff-only
  else
    git_auth clone "$wiki_url" "$wiki_directory"
  fi
  cp wiki/*.md "$wiki_directory/"
  git_auth -C "$wiki_directory" config user.name "$(git config user.name)"
  git_auth -C "$wiki_directory" config user.email "$(git config user.email)"
  git_auth -C "$wiki_directory" add .
  if ! git -C "$wiki_directory" diff --cached --quiet; then
    git_auth -C "$wiki_directory" commit -m 'Publish user and developer documentation'
  fi
  git_auth -C "$wiki_directory" push
else
  printf '\nWiki source is in the main repository. Create Home at https://github.com/%s/wiki and run this script again.\n' "$repository"
fi

gh workflow run docs.yml --ref main --repo "$repository"
printf '\nRepository: https://github.com/%s\nDocumentation: https://yinzhenCoder.github.io/remember-desktop/\n' "$repository"
