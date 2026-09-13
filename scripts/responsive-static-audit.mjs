import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scanRoots = ["app"];
const textExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".css"]);
const files = [];

function collect(relative) {
  const full = path.join(root, relative);
  if (!fs.existsSync(full)) return;
  const stat = fs.statSync(full);
  if (stat.isFile()) {
    if (textExtensions.has(path.extname(full))) files.push(relative);
    return;
  }
  for (const entry of fs.readdirSync(full)) collect(path.join(relative, entry));
}

scanRoots.forEach(collect);

const errors = [];
const forbidden = [
  [/navigator\.userAgent/i, "Do not device-sniff userAgent; use responsive CSS/capability queries."],
  [/navigator\.platform/i, "Do not device-sniff navigator.platform; use responsive CSS/capability queries."],
  [/screen\.(width|height)/i, "Do not branch behavior on physical screen dimensions; use layout/capability queries."],
  [/onMouse(?:Down|Up|Move|Enter|Leave)\s*=/, "Use pointer/click/focus behavior instead of mouse-only interaction handlers."],
  [/onTouch(?:Start|Move|End|Cancel)\s*=/, "Use Pointer Events instead of touch-only interaction handlers."],
];

for (const relative of files) {
  if (!/\.(?:tsx?|jsx?)$/.test(relative)) continue;
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  for (const [pattern, message] of forbidden) {
    if (pattern.test(source)) errors.push(`${relative}: ${message}`);
  }
}

const rootLayoutPath = path.join(root, "app/layout.tsx");
if (!fs.existsSync(rootLayoutPath)) {
  errors.push("app/layout.tsx is missing; responsive viewport contract cannot be verified.");
} else {
  const layout = fs.readFileSync(rootLayoutPath, "utf8");
  if (!/width:\s*["']device-width["']/.test(layout)) errors.push("app/layout.tsx must keep viewport width=device-width.");
  if (!/initialScale:\s*1/.test(layout)) errors.push("app/layout.tsx must keep initialScale: 1.");
  if (!/viewportFit:\s*["']cover["']/.test(layout)) errors.push("app/layout.tsx must keep viewportFit: cover for safe-area devices.");
}

if (errors.length) {
  console.error("Cross-platform static audit failed:\n" + errors.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log(`Cross-platform static audit passed (${files.length} app source files checked).`);
