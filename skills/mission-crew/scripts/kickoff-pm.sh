#!/usr/bin/env bash
# Captain kickoff: create a worktree, move BRIEF into it, start and appoint PM only.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: kickoff-pm.sh --slug <slug> [--repo <path>] [--branch <name>] [--brief <path>] [--pm-kind <kind>]

Creates a Git worktree via herdr, moves openspec/changes/<slug>/BRIEF.md into
that worktree, starts agent pm-<slug>, and sends the PM appointment prompt.
Run from the main project checkout, or pass --repo to it explicitly.

Options:
  --slug       Mission slug (required). Must match ^[a-z][a-z0-9_-]*$
  --repo       Main checkout path (default: current directory)
  --branch     Worktree branch (default: mission/<slug>)
  --brief      BRIEF path (default: <repo>/openspec/changes/<slug>/BRIEF.md)
  --pm-kind    herdr agent kind for PM (default: cursor)
  -h, --help   Show help
EOF
}

SLUG=""
REPO=""
BRANCH=""
BRIEF=""
PM_KIND="cursor"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --slug)
      SLUG="${2:-}"
      shift 2
      ;;
    --repo)
      REPO="${2:-}"
      shift 2
      ;;
    --branch)
      BRANCH="${2:-}"
      shift 2
      ;;
    --brief)
      BRIEF="${2:-}"
      shift 2
      ;;
    --pm-kind)
      PM_KIND="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$SLUG" ]]; then
  echo "--slug is required" >&2
  usage >&2
  exit 2
fi

if [[ ! "$SLUG" =~ ^[a-z][a-z0-9_-]*$ ]]; then
  echo "invalid slug: $SLUG (expected ^[a-z][a-z0-9_-]*\$)" >&2
  exit 2
fi

PM_NAME="pm-${SLUG}"
if [[ ! "$PM_NAME" =~ ^[a-z][a-z0-9_-]{0,31}$ ]]; then
  echo "agent name too long or invalid: $PM_NAME (max 32 chars, [a-z][a-z0-9_-]*)" >&2
  exit 2
fi

if [[ -z "$REPO" ]]; then
  REPO="$(pwd)"
fi
REPO="$(cd "$REPO" && pwd)"

if [[ -z "$BRANCH" ]]; then
  BRANCH="mission/${SLUG}"
fi

if [[ -z "$BRIEF" ]]; then
  BRIEF="${REPO}/openspec/changes/${SLUG}/BRIEF.md"
fi

if [[ ! -f "$BRIEF" ]]; then
  echo "BRIEF not found: $BRIEF" >&2
  exit 1
fi

for cmd in herdr jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "missing required command: $cmd" >&2
    exit 1
  fi
done

created="$(
  herdr worktree create \
    --cwd "$REPO" \
    --branch "$BRANCH" \
    --label "$SLUG" \
    --no-focus
)"

pane_id="$(printf '%s\n' "$created" | jq -r '.result.root_pane.pane_id // empty')"
worktree_path="$(printf '%s\n' "$created" | jq -r '.result.worktree.path // .result.root_pane.cwd // empty')"

if [[ -z "$pane_id" || -z "$worktree_path" || "$pane_id" == "null" || "$worktree_path" == "null" ]]; then
  echo "failed to parse worktree create response:" >&2
  printf '%s\n' "$created" >&2
  exit 1
fi

dest_dir="${worktree_path}/openspec/changes/${SLUG}"
dest_brief="${dest_dir}/BRIEF.md"
mkdir -p "$dest_dir"

echo "moving BRIEF: $BRIEF -> $dest_brief"
mv "$BRIEF" "$dest_brief"

# Clean empty slug dir (and changes/ if empty) from the main checkout.
src_dir="$(dirname "$BRIEF")"
rmdir "$src_dir" 2>/dev/null || true
rmdir "$(dirname "$src_dir")" 2>/dev/null || true

# New panes need a moment to reach an interactive shell prompt.
sleep 1

echo "starting PM agent: $PM_NAME (kind=$PM_KIND, pane=$pane_id)"
if ! herdr agent start "$PM_NAME" --kind "$PM_KIND" --pane "$pane_id" --timeout 120000; then
  echo "kickoff failed: PM agent did not start; BRIEF is at $dest_brief" >&2
  exit 1
fi

# Some agents (e.g. cursor) show a first-run workspace-trust dialog after
# herdr already reports them ready; prompts sent in that window are silently
# dropped even though `agent prompt` exits 0. Agent status cannot be trusted
# here either: screen detection falls back to "idle" while the dialog is up.
# Prove the input path end-to-end with a probe before the real prompt.
echo "waiting for PM agent to become idle: $PM_NAME"
if ! herdr agent wait "$PM_NAME" --until idle --timeout 120000; then
  echo "kickoff failed: PM agent did not become idle; PM=${PM_NAME}, BRIEF=$dest_brief" >&2
  exit 1
fi

echo "probing PM input path: $PM_NAME"
probe_ok=0
for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
  herdr agent prompt "$PM_NAME" "Reply with exactly: PONG" >/dev/null 2>&1 || true
  # The echoed probe request contains "PONG" too; only accept a bare PONG line.
  # Use recent-unwrapped so the echoed request stays one logical line and
  # cannot wrap into a false bare-PONG match.
  if herdr pane wait-output "$pane_id" --regex '^ *PONG *$' --source recent-unwrapped --lines 100 --timeout 15000 >/dev/null 2>&1; then
    probe_ok=1
    break
  fi
  echo "probe attempt $attempt: PM not responsive yet; retrying"
done
if [ "$probe_ok" -ne 1 ]; then
  echo "kickoff failed: PM did not respond to probe; PM=${PM_NAME}, BRIEF=$dest_brief" >&2
  exit 1
fi

pm_prompt="You are appointed PM for mission slug=${SLUG}. Use skill mission-crew as PM. Working directory is this worktree checkout: ${worktree_path}. Read openspec/changes/${SLUG}/BRIEF.md, then use the OpenSpec propose skill to create the proposal for this change. Self-check proposal alignment against the BRIEF, then delete BRIEF.md. v1: do not start other agents; do not write design/tasks/code. When finished, reply with: PM_DONE slug=${SLUG}"

echo "sending PM appointment prompt"
if ! herdr agent prompt "$PM_NAME" "$pm_prompt"; then
  echo "kickoff failed: PM prompt was not delivered; PM=${PM_NAME}, BRIEF=$dest_brief" >&2
  exit 1
fi

cat <<EOF
kickoff ok
slug=${SLUG}
branch=${BRANCH}
worktree=${worktree_path}
pane=${pane_id}
pm=${PM_NAME}
brief=${dest_brief}
monitor: herdr pane wait-output ${pane_id} --regex '^ *PM_DONE ' --source recent-unwrapped --lines 400 --timeout 600000
EOF
