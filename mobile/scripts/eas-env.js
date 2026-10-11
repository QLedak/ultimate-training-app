// Copies the public values from mobile/.env into eas.json so cloud builds (TestFlight) can see them.
// Run from the mobile folder:  node scripts/eas-env.js
const fs = require("fs");
const path = require("path");
const { buildEasEnv, applyEnv } = require("./eas-env.core");

const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env");
const easPath = path.join(root, "eas.json");

if (!fs.existsSync(envPath)) {
  console.error("No mobile/.env found. Copy .env.example to .env and fill it in first.");
  process.exit(1);
}
const result = buildEasEnv(fs.readFileSync(envPath, "utf8"));
if (!result.ok) {
  console.error(result.error);
  process.exit(1);
}
const eas = JSON.parse(fs.readFileSync(easPath, "utf8"));
fs.writeFileSync(easPath, JSON.stringify(applyEnv(eas, result.env), null, 2) + "\n");
console.log(`Updated eas.json with: ${Object.keys(result.env).join(", ")}`);
