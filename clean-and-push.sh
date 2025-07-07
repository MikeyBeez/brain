#!/bin/bash
# Clean feature/smart-notes branch and push changes

cd /Users/bard/Code/brain

echo "🧹 Cleaning feature/smart-notes branch"
echo "===================================="
echo

# Check we're on the right branch
current_branch=$(git branch --show-current)
if [ "$current_branch" != "feature/smart-notes" ]; then
    echo "❌ Error: Not on feature/smart-notes branch"
    echo "Current branch: $current_branch"
    exit 1
fi

echo "✅ On feature/smart-notes branch"
echo

# Step 1: Commit current changes
echo "📝 Step 1: Committing current changes..."
git add .
git commit -m "Add monitoring system and remove logs from tracking

- Add Monitex execution monitoring UI
- Add brain-monitor management script  
- Fix execution detail loading
- Remove logs from tracking and update .gitignore
- Add LaunchAgent configurations for auto-start
- Add new Brain tools (analyze, obsidian, unified_search)"

echo
echo "✅ Changes committed locally"
echo

# Step 2: Clean the history
echo "🔧 Step 2: Removing logs from branch history..."
git filter-branch --force --index-filter \
  'git rm -r --cached --ignore-unmatch logs/' \
  --prune-empty --tag-name-filter cat -- feature/smart-notes

echo
echo "✅ History cleaned"
echo

# Step 3: Verify
echo "🔍 Step 3: Verifying logs are removed..."
remaining=$(git log --name-only --pretty=format: -- logs/ | grep -E "\.json$" | wc -l)
if [ "$remaining" -eq 0 ]; then
    echo "✅ All log files removed from history!"
else
    echo "⚠️  Warning: $remaining log entries might remain"
fi

echo
echo "📊 Current status:"
git log --oneline -5
echo

echo "🚀 Ready to push!"
echo
echo "Run this command to update GitHub:"
echo "  git push origin feature/smart-notes --force"
echo
echo "⚠️  This will force-update the feature/smart-notes branch on GitHub"
echo "Anyone else working on this branch will need to:"
echo "  git fetch origin"
echo "  git reset --hard origin/feature/smart-notes"
