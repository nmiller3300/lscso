import { execFileSync } from "node:child_process";

const baseSha = process.env.CHANGELOG_BASE_SHA?.trim();

if (!baseSha || /^0+$/.test(baseSha)) {
  console.log("No usable base SHA was supplied; skipping lifetime changelog policy check.");
  process.exit(0);
}

let changedFiles;
try {
  changedFiles = execFileSync("git", ["diff", "--name-only", baseSha, "HEAD"], {
    encoding: "utf8",
  })
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean);
} catch (error) {
  console.error("Unable to determine changed files for lifetime changelog enforcement.");
  throw error;
}

if (!changedFiles.length) {
  console.log("No changed files detected.");
  process.exit(0);
}

const functionalChanges = changedFiles.filter((file) => {
  if (file === "CHANGELOG.md") return false;
  if (file.startsWith("docs/")) return false;
  if (file.endsWith(".md")) return false;
  return true;
});

if (!functionalChanges.length) {
  console.log("Only documentation/changelog files changed; no lifetime changelog entry required.");
  process.exit(0);
}

if (!changedFiles.includes("CHANGELOG.md")) {
  console.error("\nLifetime changelog policy failed.");
  console.error("Functional files changed without a matching CHANGELOG.md update:");
  for (const file of functionalChanges) console.error(`  - ${file}`);
  console.error("\nAdd a dated CHANGELOG.md entry describing the lasting create/add/remove/change/fix/security/operations behavior in this same change set.\n");
  process.exit(1);
}

console.log(`Lifetime changelog policy passed: ${functionalChanges.length} functional file(s) changed and CHANGELOG.md was updated.`);
