#!/usr/bin/env bash
# Publish gate: fail on private names, home paths or secret-shaped strings in the tracked tree.
set -u
cd "$(dirname "$0")/.."
files=$(git ls-files 2>/dev/null || find . -type f -not -path './node_modules/*' -not -path './.git/*')
fail=0
# Private-name list is kept outside the repo; set AUDIT_TERMS="name1|name2" to extend the generic checks.
pat="/Users/|/home/[a-z]|\\.lodestar|${AUDIT_TERMS:-__none__}"
if echo "$files" | grep -v '^scripts/publish-audit.sh$' | xargs grep -nE "$pat" 2>/dev/null; then fail=1; fi
sec='sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_|xox[bp]-|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE'
if echo "$files" | grep -vE "^(bun.lock|scripts/publish-audit.sh)$" | xargs grep -nE "$sec" 2>/dev/null; then fail=1; fi
[ $fail -eq 0 ] && echo "audit: clean" || { echo "audit: FAILED"; exit 1; }
