// One-time setup after `create-expo-app`: adds our npm scripts and names the app.
// Safe to re-run. Usage (from the mobile folder):
//   node scripts/finish-setup.js "Ultimate Training" com.yourname.ultimatetraining
// Both arguments are optional on a re-run: an app name or id already in app.json is kept.
const fs = require("fs");
const path = require("path");

const pkgPath = path.join(__dirname, "..", "package.json");
const appPath = path.join(__dirname, "..", "app.json");

const existing = fs.existsSync(appPath) ? JSON.parse(fs.readFileSync(appPath, "utf8")).expo || {} : {};
const displayName = process.argv[2] || existing.name || "Ultimate Training";
const bundleId = process.argv[3] || (existing.ios && existing.ios.bundleIdentifier) || "com.example.ultimatetraining";
const slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "ultimate-training";

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
app.expo.version = app.expo.version || "1.0.0";
app.expo.ios = {
  ...(app.expo.ios || {}),
  bundleIdentifier: bundleId,
  supportsTablet: false,
  // The app only uses the standard HTTPS encryption built into iOS, so TestFlight/App Store skip the export-compliance question.
  infoPlist: { ...((app.expo.ios || {}).infoPlist || {}), ITSAppUsesNonExemptEncryption: false },
};
app.expo.android = { ...(app.expo.android || {}), package: bundleId };
app.expo.userInterfaceStyle = "dark";
app.expo.backgroundColor = "#15181B";

// Brand icon (Arc T on asphalt), splash mark and Android adaptive icon live in ./assets.
app.expo.icon = "./assets/icon.png";
app.expo.android = {
  ...app.expo.android,
  adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: "#24282D" },
};
app.expo.web = { ...(app.expo.web || {}), favicon: "./assets/favicon.png" };
const splash = { image: "./assets/splash-icon.png", imageWidth: 200, resizeMode: "contain", backgroundColor: "#15181B" };
app.expo.plugins = app.expo.plugins || [];
const hasSplashPlugin = app.expo.plugins.some((p) => (Array.isArray(p) ? p[0] : p) === "expo-splash-screen");
if (app.expo.splash || !hasSplashPlugin) {
  // Older templates use the top-level "splash" key; newer ones configure the plugin instead.
  if (app.expo.splash) app.expo.splash = { ...app.expo.splash, ...splash };
  else app.expo.plugins.push(["expo-splash-screen", splash]);
} else {
  app.expo.plugins = app.expo.plugins.map((p) => ((Array.isArray(p) ? p[0] : p) === "expo-splash-screen" ? ["expo-splash-screen", splash] : p));
}
const notif = ["expo-notifications", { color: "#F47A20" }];
if (!app.expo.plugins.some((p) => (Array.isArray(p) ? p[0] : p) === "expo-notifications")) {
  app.expo.plugins.push(notif);
} else {
  app.expo.plugins = app.expo.plugins.map((p) => ((Array.isArray(p) ? p[0] : p) === "expo-notifications" ? notif : p));
}
fs.writeFileSync(appPath, JSON.stringify(app, null, 2) + "\n");

console.log(`Done. App name: ${displayName}, id: ${bundleId}`);
