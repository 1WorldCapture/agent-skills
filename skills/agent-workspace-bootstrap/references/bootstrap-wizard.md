# Bootstrap Wizard reference

Use this file when the user asks how initialization questions are collected or when an Agent must drive the script from a conversational Harness.

## Question order

The wizard uses the current working directory as the Agent Home and displays it. It does not ask the user to enter a path. It then confirms, in order:

1. Harness adapters: `portable`, `cursor`, `zcode`, or a comma-separated combination.
2. Agent ID: a lowercase slug suggested from the project directory.
3. Agent display name: the project directory name by default.
4. Role: a general-purpose project Agent by default.
5. Mission: required; there is no TODO fallback.
6. Working language: suggested from the local locale.
7. IANA timezone: suggested from `TZ` or `/etc/localtime`.
8. Optional model, approved tools, and domain Skills.

The wizard prints all selected values and asks for one final yes/no confirmation. A negative answer exits without creating directories or files.

## Mandatory versus optional

Mandatory values must be known before `write_scaffold()` runs: Agent ID, name, role, mission, Harness adapters, language, and timezone. Suggestions are allowed, but the user must accept or replace them.

Optional values may remain unconfigured. Generated files use the explicit value `Not configured` or `none configured`; they do not contain long TODO placeholders. Board connection, routines, user profile, and scheduler settings are separate workflows.

## Conversational Harness flow

When the Skill is invoked from Cursor, Zcode, Codex, or another conversational Harness:

1. Establish that the current working directory is the intended project root.
2. Ask only the mandatory questions above, offering the detected defaults.
3. Ask which optional model, tools, or domain Skills should be recorded; allow the user to skip them.
4. Show the complete plan, including the current path and requested adapters.
5. After user confirmation, invoke the script with `--non-interactive` and all mandatory flags. Add optional flags only when supplied.
6. Run `validate` and report created, skipped, conflicts, warnings, and errors.

Do not invoke `--non-interactive` with missing mandatory flags. The script rejects that call before writing anything.

## Direct terminal flow

Run this from the target project root and answer the prompts:

```bash
python3 <skill-directory>/scripts/bootstrap.py --root "$PWD" --mode bootstrap
```

For an already reviewed plan, use explicit values:

```bash
python3 <skill-directory>/scripts/bootstrap.py \
  --root "$PWD" --mode bootstrap --non-interactive \
  --agent-id project-agent \
  --name "Project Agent" \
  --role "Project maintainer" \
  --mission "Maintain this project safely" \
  --language zh-CN \
  --timezone America/Los_Angeles
```

`--root` remains available for clarity, but it must resolve to the current working directory. The script refuses to scaffold another directory.
