// Copies the pure training-logic files from the web app into src/shared so the
// phone app uses EXACTLY the same rules (effort scale, weight suggestions,
// prescription parsing). Run automatically before `npm start`.
// Never edit files in src/shared by hand - edit the originals in ../lib and re-run.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..", "lib");
const dest = path.join(__dirname, "..", "src", "shared");
const files = [
  ["training/perceived-effort.ts", "perceived-effort.ts"],
  ["training/autoregulate.ts", "autoregulate.ts"],
  ["training/display-labels.ts", "display-labels.ts"],
  ["pps/parse-prescription.ts", "parse-prescription.ts"],
];

if (!fs.existsSync(root)) {
  console.log("sync-shared: ../lib not found (running outside the repo?) - keeping existing src/shared.");
  process.exit(0);
}
fs.mkdirSync(dest, { recursive: true });
for (const [from, to] of files) {
  fs.copyFileSync(path.join(root, from), path.join(dest, to));
}
console.log(`sync-shared: copied ${files.length} files into src/shared`);
