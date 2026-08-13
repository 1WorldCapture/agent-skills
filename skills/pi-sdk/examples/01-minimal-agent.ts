/**
 * Minimal Pi SDK agent (isolated demo).
 *
 * Prerequisites: npm install @earendil-works/pi-coding-agent
 * Run:
 *   npx tsx examples/01-minimal-agent.ts
 *
 * Uses top-level await, so it needs an ESM context: run it through tsx as
 * above, or set "type": "module" before importing it into a project.
 */

import {
	createAgentSession,
	ModelRuntime,
	SessionManager,
	SettingsManager,
} from "@earendil-works/pi-coding-agent";

const modelRuntime = await ModelRuntime.create();
const available = await modelRuntime.getAvailable();
if (available.length === 0) {
	throw new Error(
		"No authenticated models available. Configure ~/.pi/agent/auth.json or set provider API key env vars, then retry.",
	);
}

const { session } = await createAgentSession({
	model: available[0],
	thinkingLevel: "off",
	modelRuntime,
	sessionManager: SessionManager.inMemory(),
	settingsManager: SettingsManager.inMemory({}),
});

try {
	session.subscribe((event) => {
		if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
			process.stdout.write(event.assistantMessageEvent.delta);
		}
	});

	await session.prompt("Say hello in one sentence.");
	console.log();
} finally {
	session.dispose();
}
