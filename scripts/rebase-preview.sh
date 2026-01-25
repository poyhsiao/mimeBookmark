#!/bin/bash

echo "=== Feature Branch Rebase Helper ==="
echo ""

if [ -z "$1" ]; then
  echo "Usage: ./scripts/rebase-preview.sh <branch-name>"
  echo ""
  echo "Example:"
  echo "  ./scripts/rebase-preview.sh feature/recommendation-system"
  exit 1
fi

BRANCH=$1
git fetch origin main > /dev/null 2>&1

echo "Analyzing branch: $BRANCH"
echo "Base branch: origin/main"
echo ""

if ! git show-ref --verify refs/origin/$BRANCH > /dev/null 2>&1; then
  echo "Error: Branch '$BRANCH' does not exist on origin"
  exit 1
fi

if [[ ! "$BRANCH" =~ ^feature/ ]]; then
  echo "Warning: Branch '$BRANCH' does not start with 'feature/'"
  echo "The automated workflow only processes feature branches"
  echo ""
fi

COMMITS=$(git log origin/main..origin/$BRANCH --oneline --no-decorate 2>/dev/null)

if [ -z "$COMMITS" ]; then
  echo "No new commits on $BRANCH compared to origin/main"
  echo "Generated commit message:"
  echo "  chore: $BRANCH - rebase feature branch"
  exit 0
fi

echo "Commits that will be rebased:"
echo "$COMMITS"
echo ""

FEAT_COUNT=$(echo "$COMMITS" | grep -c "^.*feat:" || echo 0)
FIX_COUNT=$(echo "$COMMITS" | grep -c "^.*fix:" || echo 0)
DOCS_COUNT=$(echo "$COMMITS" | grep -c "^.*docs:" || echo 0)
REFACTOR_COUNT=$(echo "$COMMITS" | grep -c "^.*refactor:" || echo 0)
CHORE_COUNT=$(echo "$COMMITS" | grep -c "^.*chore:" || echo 0)

echo "Commit type analysis:"
echo "  feat:    $FEAT_COUNT"
echo "  fix:      $FIX_COUNT"
echo "  docs:     $DOCS_COUNT"
echo "  refactor: $REFACTOR_COUNT"
echo "  chore:    $CHORE_COUNT"
echo ""

DOMINANT_TYPE="chore"
MAX_COUNT=$CHORE_COUNT

if [ $FEAT_COUNT -gt $MAX_COUNT ]; then
  DOMINANT_TYPE="feat"
  MAX_COUNT=$FEAT_COUNT
fi
if [ $FIX_COUNT -gt $MAX_COUNT ]; then
  DOMINANT_TYPE="fix"
  MAX_COUNT=$FIX_COUNT
fi
if [ $DOCS_COUNT -gt $MAX_COUNT ]; then
  DOMINANT_TYPE="docs"
  MAX_COUNT=$DOCS_COUNT
fi
if [ $REFACTOR_COUNT -gt $MAX_COUNT ]; then
  DOMINANT_TYPE="refactor"
  MAX_COUNT=$REFACTOR_COUNT
fi

FEATURE_NAME=$(echo "$BRANCH" | sed 's/^feature\///')

case $DOMINANT_TYPE in
  feat)
      SCOPE="(rebase)"
      MESSAGE="feat${SCOPE}: ${FEATURE_NAME} - rebase onto main"
      ;;
  fix)
      SCOPE="(rebase)"
      MESSAGE="fix${SCOPE}: ${FEATURE_NAME} - rebase bug fixes onto main"
      ;;
  docs)
      SCOPE="(rebase)"
      MESSAGE="docs${SCOPE}: ${FEATURE_NAME} - update documentation via rebase"
      ;;
  refactor)
      SCOPE="(rebase)"
      MESSAGE="refactor${SCOPE}: ${FEATURE_NAME} - rebase refactored code onto main"
      ;;
  *)
      MESSAGE="chore: ${FEATURE_NAME} - rebase feature branch onto main"
      ;;
esac

echo "Generated commit message:"
echo "  $MESSAGE"
echo ""

echo "To rebase this branch:"
echo "  git checkout $BRANCH"
echo "  git fetch origin main"
echo "  git rebase origin/main"
echo "  git push --force-with-lease origin $BRANCH"
