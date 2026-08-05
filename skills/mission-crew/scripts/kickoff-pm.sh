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

# Wait for managed startup to settle before sending the appointment. The
# appointment itself is submitted with --wait so Herdr must observe a new
# working transition instead of reporting success after only queueing bytes.
echo "waiting for PM agent to become idle: $PM_NAME"
if ! herdr agent wait "$PM_NAME" --until idle --timeout 120000; then
  echo "kickoff failed: PM agent did not become idle; PM=${PM_NAME}, BRIEF=$dest_brief" >&2
  exit 1
fi

pm_prompt="You are appointed PM for mission slug=${SLUG}. Use skill mission-crew as PM. Working directory is this worktree checkout: ${worktree_path}. Read openspec/changes/${SLUG}/BRIEF.md, then use the OpenSpec explore skill to investigate the codebase and refine the BRIEF (clarifications only, no scope growth; keep BRIEF.md in place). Then kick off Design, Impl, and QA one at a time with the mission-crew kickoff-worker.sh script, wait for each *_DONE marker, and proceed to the next stage. Trust each stage's completion marker as the stage result. When the whole pipeline is finished, reply with: PM_DONE slug=${SLUG}"

echo "sending PM appointment prompt"
prompt_started=0
for attempt in 1 2 3; do
  if herdr agent prompt "$PM_NAME" "$pm_prompt" --wait --until working --timeout 15000 >/dev/null; then
    prompt_started=1
    break
  fi

  observed_status="$(herdr agent get "$PM_NAME" 2>/dev/null | jq -r '.result.agent.agent_status // "unknown"' 2>/dev/null || printf 'unknown')"
  if [[ "$observed_status" == "working" ]]; then
    prompt_started=1
    break
  fi
  if [[ "$observed_status" != "idle" && "$observed_status" != "unknown" ]]; then
    break
  fi
  echo "PM appointment attempt ${attempt} did not start a working turn; retrying"
  sleep 1
done
if [ "$prompt_started" -ne 1 ]; then
  echo "kickoff failed: PM prompt did not start a working turn; PM=${PM_NAME}, BRIEF=$dest_brief" >&2
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
monitor: herdr pane wait-output ${pane_id} --regex '^[^[:alnum:]]{0,3}PM_DONE ' --source recent-unwrapped --lines 400 --timeout 300000
EOF
