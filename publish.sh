#!/bin/bash
set -e

# Publish browsermonitor to npm + GitHub with tag and release
# Usage: ./publish.sh [patch|minor|major]
#   Default: patch

BUMP="${1:-patch}"
TOKEN_FILE="$HOME/.npm-token-browsermonitor"
REPO="romanmatena/browsermonitor"

# Check for npm token
if [ ! -f "$TOKEN_FILE" ]; then
  echo "Missing npm token file: $TOKEN_FILE"
  echo "Create it with: echo 'npm_YOUR_TOKEN' > $TOKEN_FILE && chmod 600 $TOKEN_FILE"
  exit 1
fi
NPM_TOKEN=$(cat "$TOKEN_FILE")

# Check gh is authenticated
if ! gh auth status >/dev/null 2>&1; then
  echo "Error: gh not authenticated. Run: gh auth login"
  exit 1
fi

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: uncommitted changes. Commit first."
  exit 1
fi

# Bump version
OLD_VERSION=$(node -p "require('./package.json').version")
npm version "$BUMP" --no-git-tag-version
NEW_VERSION=$(node -p "require('./package.json').version")
echo "Version: $OLD_VERSION -> $NEW_VERSION"

# Commit and tag
git add package.json
git commit -m "v$NEW_VERSION"
git tag "v$NEW_VERSION"

# Push to origin (GitLab) with tag
git push origin master --tags

# Push to GitHub with tag
git push github master:main --force --tags

# Publish to npm
npm config set //registry.npmjs.org/:_authToken "$NPM_TOKEN"
npm publish --access public
npm config delete //registry.npmjs.org/:_authToken

# Create GitHub release
gh release create "v$NEW_VERSION" --repo "$REPO" --title "v$NEW_VERSION" --generate-notes

echo ""
echo "Published @romanmatena/browsermonitor@$NEW_VERSION"
echo "  npm: https://www.npmjs.com/package/@romanmatena/browsermonitor"
echo "  GitHub: https://github.com/$REPO/releases/tag/v$NEW_VERSION"
