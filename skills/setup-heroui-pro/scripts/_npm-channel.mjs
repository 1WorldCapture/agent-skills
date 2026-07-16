import {spawnSync} from "node:child_process";

export function resolveNpmChannelVersion(packageName, channel = "stable") {
  if (!new Set(["stable", "beta"]).has(channel)) throw new Error(`Unsupported release channel: ${channel}`);
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npm, ["view", packageName, "dist-tags", "--json"], {encoding: "utf8"});
  if (result.error) throw new Error(`Unable to resolve ${packageName} versions: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`Unable to resolve ${packageName} versions: ${result.stderr.trim()}`);
  let tags;
  try {
    tags = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Invalid npm dist-tags response for ${packageName}: ${error.message}`);
  }
  const tag = channel === "stable" ? "latest" : "beta";
  const version = tags[tag];
  if (!version) throw new Error(`${packageName} has no ${tag} dist-tag.`);
  const prerelease = String(version).includes("-");
  if (channel === "stable" && prerelease) {
    throw new Error(`${packageName}@latest resolved to prerelease ${version}; stable mode refuses to continue.`);
  }
  return String(version);
}
