#!/usr/bin/env bash
#
# Mirror docs/wiki/ to the GitHub wiki.
#
# The wiki is a mirror, not the source. Sources live in docs/wiki/ so that
# documentation changes go through pull requests like code does -- a wiki
# edited only in the browser is invisible to review, which is how docs drift
# away from the thing they describe.
#
# One consequence worth knowing: the page links are written for the wiki, so
# they have no .md suffix. That is correct at the destination and broken when
# browsing docs/wiki/ in the repo. The wiki is the reading surface; the repo
# copy is the source of truth.
#
# GitHub does not create the wiki's git remote until the first page exists,
# and there is no API for wiki content. If this script reports the repo is
# missing, create any page once in the browser and re-run.
#
# Usage:  ./scripts/sync-wiki.sh [remote-url]

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$REPO_ROOT/docs/wiki"
WIKI_URL="${1:-https://github.com/getnimishk/PrepBench.wiki.git}"

[ -d "$SRC" ] || { echo "No such directory: $SRC" >&2; exit 1; }

if ! git ls-remote "$WIKI_URL" >/dev/null 2>&1; then
  cat >&2 <<MSG
The wiki repository does not exist yet.

GitHub creates it only after the first page is saved through the web UI, and
there is no API to do it for you. Create one page here, then re-run:

  https://github.com/getnimishk/PrepBench/wiki/_new

MSG
  exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

git clone --quiet --depth 1 "$WIKI_URL" "$WORK/wiki"
cp "$SRC"/*.md "$WORK/wiki/"

cd "$WORK/wiki"

# The wiki is a fresh clone in a temp directory, so it inherits no identity
# when git is configured per-repo rather than globally. Carry the parent
# repo's over rather than requiring a --global config just to sync docs.
for key in user.name user.email; do
  value="$(git -C "$REPO_ROOT" config "$key" || true)"
  [ -n "$value" ] && git config "$key" "$value"
done

if git diff --quiet && git diff --cached --quiet && [ -z "$(git status --porcelain)" ]; then
  echo "Wiki already matches docs/wiki/ -- nothing to push."
  exit 0
fi

git add -A
git commit --quiet -m "Sync wiki from docs/wiki/ at $(git -C "$REPO_ROOT" rev-parse --short HEAD)"
git push --quiet origin HEAD

echo "Pushed $(ls -1 "$SRC"/*.md | wc -l | tr -d ' ') pages to $WIKI_URL"
