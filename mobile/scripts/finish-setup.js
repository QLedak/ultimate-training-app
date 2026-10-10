// One-time setup after `create-expo-app`: adds our npm scripts and names the app.
// Usage (from the mobile folder):
//   node scripts/finish-setup.js "Ultimate Training" com.yourname.ultimatetraining
const fs = require("fs");
const path = require("path");

const displayName = process.argv[2] || "Ultimate Training";
const bundleId = process.argv[3] || "com.example.ultimatetraining";
const slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "ultimate-training";

const pkgPath = path.join(__dirname, "..", "package.json");
const appPath = path.join(__dirname, "..", "app.json");

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
pkg.scripts = {
  ...pkg.scripts,
  sync: "node scripts/sync-shared.js",
  prestart: "node scripts/sync-shared.js",
};
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

const app = JSON.parse(fs.readFileSync(appPath, "utf8"));
app.expo = app.expo || {};
app.expo.name = displayName;
app.expo.slug = slug;
app.expo.scheme = slug;
app.expo.ios = { ...(app.expo.ios || {}), bundleIdentifier: bundleId, supportsTablet: false };
app.expo.android = { ...(app.expo.android || {}), package: bundleId };
app.expo.userInterfaceStyle = "light";
fs.writeFileSync(appPath, JSON.stringify(app, null, 2) + "\n");

console.log(`Done. App name: ${displayName}, id: ${bundleId}`);
