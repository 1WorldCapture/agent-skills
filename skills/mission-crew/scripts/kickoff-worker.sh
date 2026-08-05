#!/usr/bin/env bash
# PM kickoff: split a pane in the mission worktree workspace, start and appoint
# one worker agent (Design / Impl / QA) for an existing mission.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: kickoff-worker.sh --slug <slug> --role <design|impl|qa> [--kind <kind>] [--pm-pane <id>] [-- <agent args>]

Splits a new pane off the PM pane in the mission worktree workspace, starts
agent <role>-<slug>, and sends the role appointment prompt. Run by PM from
inside the mission worktree.

Options:
  --slug       Mission slug (required). Must match ^[a-z][a-z0-9_-]*$
  --role       Worker role: design | impl | qa (required)
  --kind       herdr agent kind (default per role: design/qa=codex, impl=grok)
  --pm-pane    PM pane id to split from (default: $HERDR_PANE_ID, else resolved
               via `herdr agent get pm-<slug>`)
  -h, --help   Show help

Agent CLI args may follow `--`, e.g.:
  kickoff-worker.sh --slug x --role design -- -m gpt-5.6-sol -c 'model_reasoning_effort="high"'
Defaults for codex roles already include: -m gpt-5.6-sol -c 'model_reasoning_effort="high"'
EOF
}

SLUG=""
ROLE=""
KIND=""
PM_PANE=""
AGENT_ARGS=()
AGENT_ARGS_SET=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --slug)
      SLUG="${2:-}"
      shift 2
      ;;
    --role)
      ROLE="${2:-}"
      shift 2
      ;;
    --kind)
      KIND="${2:-}"
      shift 2
      ;;
    --pm-pane)
      PM_PANE="${2:-}"
      shift 2
      ;;
    --)
      shift
      AGENT_ARGS=("$@")
      AGENT_ARGS_SET=1
      break
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

if [[ -z "$SLUG" || -z "$ROLE" ]]; then
  echo "--slug and --role are required" >&2
  usage >&2
  exit 2
fi

if [[ ! "$SLUG" =~ ^[a-z][a-z0-9_-]*$ ]]; then
  echo "invalid slug: $SLUG (expected ^[a-z][a-z0-9_-]*\$)" >&2
  exit 2
fi

case "$ROLE" in
  design|impl|qa) ;;
  *)
    echo "invalid role: $ROLE (expected design|impl|qa)" >&2
    exit 2
    ;;
esac

# Role defaults: kind and agent CLI args (explicit --kind / -- args win).
if [[ -z "$KIND" ]]; then
  case "$ROLE" in
    design|qa) KIND="codex" ;;
    impl) KIND="grok" ;;
  esac
fi
if [[ "$AGENT_ARGS_SET" -eq 0 && "$KIND" == "codex" ]]; then
  AGENT_ARGS=(-m gpt-5.6-sol -c 'model_reasoning_effort="high"')
fi

WORKER_NAME="${ROLE}-${SLUG}"
if [[ ! "$WORKER_NAME" =~ ^[a-z][a-z0-9_-]{0,31}$ ]]; then
  echo "agent name too long or invalid: $WORKER_NAME (max 32 chars, [a-z][a-z0-9_-]*)" >&2
  exit 2
fi

for cmd in herdr jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "missing required command: $cmd" >&2
    exit 1
  fi
done

worktree_path="$(pwd)"
change_dir="openspec/changes/${SLUG}"
if [[ ! -d "$change_dir" ]]; then
  echo "change dir not found: $change_dir (run from the mission worktree root)" >&2
  exit 1
fi

# Resolve the PM pane to split from.
if [[ -z "$PM_PANE" && -n "${HERDR_PANE_ID:-}" ]]; then
  PM_PANE="$HERDR_PANE_ID"
fi
if [[ -z "$PM_PANE" ]]; then
  PM_PANE="$(herdr agent get "pm-${SLUG}" 2>/dev/null | jq -r '.result.agent.pane_id // empty')"
fi
if [[ -z "$PM_PANE" ]]; then
  echo "could not resolve PM pane; pass --pm-pane <id>" >&2
  exit 1
fi

split_out="$(herdr pane split "$PM_PANE" --direction right --no-focus)"
pane_id="$(printf '%s\n' "$split_out" | jq -r '.result.pane.pane_id // empty')"
if [[ -z "$pane_id" ]]; then
  echo "pane split failed:" >&2
  printf '%s\n' "$split_out" >&2
  exit 1
fi

# New panes need a moment to reach an interactive shell prompt.
sleep 1

echo "starting ${ROLE} agent: ${WORKER_NAME} (kind=${KIND}, pane=${pane_id})"
start_args=(agent start "$WORKER_NAME" --kind "$KIND" --pane "$pane_id" --timeout 120000)
if [[ "${#AGENT_ARGS[@]}" -gt 0 ]]; then
  start_args+=(-- "${AGENT_ARGS[@]}")
fi
if ! herdr "${start_args[@]}"; then
  echo "kickoff failed: ${ROLE} agent did not start; pane=${pane_id}" >&2
  exit 1
fi

# Wait for managed startup to settle before sending the appointment. The
# appointment itself is submitted with --wait so Herdr must observe a new
# working transition instead of reporting success after only queueing bytes.
echo "waiting for ${ROLE} agent to become idle: ${WORKER_NAME}"
if ! herdr agent wait "$WORKER_NAME" --until idle --timeout 120000; then
  echo "kickoff failed: ${ROLE} agent did not become idle; agent=${WORKER_NAME}, pane=${pane_id}" >&2
  exit 1
fi

role_upper="$(printf '%s' "$ROLE" | tr '[:lower:]' '[:upper:]')"
case "$ROLE" in
  design)
    mission_text="Read ${change_dir}/BRIEF.md, then use the OpenSpec propose skill to create the change with all artifacts (proposal.md, design.md, specs deltas, tasks.md), faithful to the BRIEF. Self-check alignment with the BRIEF, then delete BRIEF.md."
    ;;
  impl)
    mission_text="Use the OpenSpec apply-change skill to implement ${change_dir}/tasks.md for this change. Keep the implementation within the approved proposal scope."
    ;;
  qa)
    mission_text="Verify the implementation of ${change_dir} against proposal.md, design.md, and tasks.md: run the repo's checks, review the diff, and fix every issue you find."
    ;;
esac

worker_prompt="You are appointed ${role_upper} for mission slug=${SLUG}. Use skill mission-crew as ${role_upper}. Working directory is this worktree checkout: ${worktree_path}. ${mission_text} Do not start other agents. When finished, reply with: ${role_upper}_DONE slug=${SLUG}"

echo "sending ${ROLE} appointment prompt"
prompt_started=0
for attempt in 1 2 3; do
  if herdr agent prompt "$WORKER_NAME" "$worker_prompt" --wait --until working --timeout 15000 >/dev/null; then
    prompt_started=1
    break
  fi

  observed_status="$(herdr agent get "$WORKER_NAME" 2>/dev/null | jq -r '.result.agent.agent_status // "unknown"' 2>/dev/null || printf 'unknown')"
  if [[ "$observed_status" == "working" ]]; then
    prompt_started=1
    break
  fi
  if [[ "$observed_status" != "idle" && "$observed_status" != "unknown" ]]; then
    break
  fi
  echo "${ROLE} appointment attempt ${attempt} did not start a working turn; retrying"
  sleep 1
done
if [ "$prompt_started" -ne 1 ]; then
  echo "kickoff failed: ${ROLE} prompt did not start a working turn; agent=${WORKER_NAME}, pane=${pane_id}" >&2
  exit 1
fi

cat <<EOF
kickoff ok
slug=${SLUG}
role=${ROLE}
worktree=${worktree_path}
pane=${pane_id}
agent=${WORKER_NAME}
kind=${KIND}
monitor: herdr pane wait-output ${pane_id} --regex '^[^[:alnum:]]{0,3}${role_upper}_DONE ' --source recent-unwrapped --lines 400 --timeout 300000
EOF
