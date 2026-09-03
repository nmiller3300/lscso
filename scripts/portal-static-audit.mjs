import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const scanRoots=["app/portal","app/_components","app/maintenance.css","proxy.ts"];
const textExtensions=new Set([".ts",".tsx",".css",".js",".mjs"]);
const files=[];
function collect(relative){const full=path.join(root,relative);if(!fs.existsSync(full))return;const stat=fs.statSync(full);if(stat.isFile()){if(textExtensions.has(path.extname(full)))files.push(relative);return}for(const entry of fs.readdirSync(full))collect(path.join(relative,entry))}
scanRoots.forEach(collect);

const errors=[];
const legacyModalFiles=[];
const forbidden=[[/window\.confirm\s*\(/,"Use the LSCSO dialog system instead of window.confirm()."],[/window\.prompt\s*\(/,"Use the LSCSO dialog system/form controls instead of window.prompt()."]];
const imagePattern=/["'`](\/images\/[A-Za-z0-9_./-]+)["'`]/g;

for(const relative of files){
  const source=fs.readFileSync(path.join(root,relative),"utf8");
  for(const[pattern,message]of forbidden){if(pattern.test(source))errors.push(`${relative}: ${message}`)}
  if(relative.endsWith(".tsx")&&/portal-modal-backdrop/.test(source))legacyModalFiles.push(relative);
  for(const match of source.matchAll(imagePattern)){const asset=path.join(root,"public",match[1].replace(/^\//,""));if(!fs.existsSync(asset))errors.push(`${relative}: missing public asset ${match[1]}`)}
}

if(legacyModalFiles.length){
  const bridgePath=path.join(root,"app/portal/_components/LegacyPortalModalBridge.tsx");
  const shellPath=path.join(root,"app/portal/_components/PortalShell.tsx");
  if(!fs.existsSync(bridgePath))errors.push("Legacy Portal modals remain but LegacyPortalModalBridge.tsx is missing.");
  if(!fs.existsSync(shellPath)||!fs.readFileSync(shellPath,"utf8").includes("<LegacyPortalModalBridge"))errors.push("Legacy Portal modals remain but the shared modal bridge is not mounted in PortalShell.");
}

if(errors.length){console.error("Portal static audit failed:\n"+errors.map((item)=>`- ${item}`).join("\n"));process.exit(1)}
console.log(`Portal static audit passed (${files.length} source files checked; ${legacyModalFiles.length} legacy modal surface${legacyModalFiles.length===1?"":"s"} covered by the shared bridge).`);
