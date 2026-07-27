#!/usr/bin/env bash
# Opt-in managed confidential-data pre-commit hook (Exchange 2.1).
#
# Installs a repository-local .git/hooks/pre-commit that runs the confidential-data safety
# scan (finance-system/scripts/safety_scan.py) over git-tracked and git-staged files and
# BLOCKS the commit on any HIGH-severity finding, prohibited extension, tracked private
# path, or oversized data file.
#
# This installs ONLY into THIS repository's .git/hooks — it never touches global Git config.
# Run it explicitly; nothing is installed automatically.
#
# Usage:   bash finance-system/scripts/install-safety-hook.sh
# Bypass:  git commit --no-verify   (records an intentional, authorized bypass)
# Limits:  the scanner is heuristic (see finance-system/docs/THREAT_MODEL.md); it reduces
#          accidental-leak risk but does not guarantee confidentiality.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOK="$REPO_ROOT/.git/hooks/pre-commit"

cat > "$HOOK" <<'HOOK_BODY'
#!/usr/bin/env bash
# Managed confidential-data safety hook (installed by finance-system).
set -euo pipefail
REPO_ROOT="$(git rev-parse --show-toplevel)"
if ! python3 "$REPO_ROOT/finance-system/scripts/safety_scan.py"; then
  echo ""
  echo "[pre-commit] BLOCKED: confidential-data safety scan failed."
  echo "[pre-commit] Review the finding, remove/relocate the data, and retry."
  echo "[pre-commit] Authorized bypass (use with care): git commit --no-verify"
  exit 1
fi
HOOK_BODY

chmod +x "$HOOK"
echo "[install] pre-commit safety hook installed at: $HOOK"
echo "[install] bypass with 'git commit --no-verify' (authorized use only)."
