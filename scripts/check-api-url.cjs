// Fails the build if VITE_API_URL resolves to a localhost address. The real
// trigger this guards against: an .env.local left on the deploy droplet
// (gitignored, so `git pull` never removes it) silently overriding the
// host-detection in src/config/urls.js — every API call in the shipped
// build, including login, would hit 127.0.0.1 instead of the real API.
const fs = require("fs");
const path = require("path");

const LOCALHOST_RE = /127\.0\.0\.1|localhost/i;
const CANDIDATES = [".env.local", ".env.production.local", ".env.production"];

let failed = false;
for (const name of CANDIDATES) {
  const filePath = path.join(__dirname, "..", name);
  if (!fs.existsSync(filePath)) continue;
  const content = fs.readFileSync(filePath, "utf8");
  const match = content.match(/^VITE_API_URL\s*=\s*(.+)$/m);
  if (match && LOCALHOST_RE.test(match[1])) {
    console.error(
      `\n✗ ${name} sets VITE_API_URL to a localhost address (${match[1].trim()}).\n` +
      "  This file should not exist on a deploy server. If you're building " +
      "locally on purpose,\n  delete it before a real deploy build, or " +
      "unset VITE_API_URL so host-detection applies.\n"
    );
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("✓ API URL check passed (no localhost override found).");
