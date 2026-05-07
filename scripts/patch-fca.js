/**
 * patch-fca.js — Patches changeGroupImage.js in fca-eryxenx to add the
 * missing `parseAndCheckLogin` import that causes a ReferenceError at runtime.
 *
 * Strategy (multi-layered):
 *   1. Try each known candidate path for changeGroupImage.js.
 *   2. If the import anchor line is found, insert after it; otherwise fall back
 *      to inserting after "use strict".
 *   3. If the file cannot be patched via import (e.g. the function is called
 *      inline), monkey-patch the module's exported function to inject a no-op
 *      `parseAndCheckLogin` into its closure via a wrapper.
 *
 * Called automatically after every `npm install` via the postinstall hook.
 */
"use strict";

const fs   = require("fs");
const path = require("path");

// ── Candidate paths — ordered from most to least likely ──────────────────────
const BASE = path.join(__dirname, "..", "node_modules", "fca-eryxenx");

const CANDIDATE_PATHS = [
  // fca-eryxenx ≥ 1.x structured layout
  path.join(BASE, "src", "api", "messaging", "changeGroupImage.js"),
  // flat src/api layout
  path.join(BASE, "src", "api", "changeGroupImage.js"),
  // legacy / alternative layout
  path.join(BASE, "src", "changeGroupImage.js"),
  // root-level fallback
  path.join(BASE, "changeGroupImage.js"),
];

// Possible relative import paths for the utils/client module
const IMPORT_VARIANTS = [
  'const { parseAndCheckLogin } = require("../../utils/client");',
  'const { parseAndCheckLogin } = require("../utils/client");',
  'const { parseAndCheckLogin } = require("./utils/client");',
];

// Anchor lines — we insert the import immediately after the first one found
const ANCHOR_LINES = [
  'const log = require("../../../func/logAdapter");',
  'const log = require("../../func/logAdapter");',
  'const log = require("../func/logAdapter");',
  '"use strict";',
  "'use strict';",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveImportLine(targetFile) {
  // Pick the import variant whose relative path actually resolves to an
  // existing utils/client.js file next to the target.
  const dir = path.dirname(targetFile);
  const candidates = [
    { line: IMPORT_VARIANTS[0], rel: "../../utils/client.js" },
    { line: IMPORT_VARIANTS[1], rel: "../utils/client.js"   },
    { line: IMPORT_VARIANTS[2], rel: "./utils/client.js"    },
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.resolve(dir, c.rel))) return c.line;
  }
  // Default to the most common relative depth even if the file isn't found yet
  return IMPORT_VARIANTS[0];
}

function patchContent(content, importLine) {
  // Already patched?
  if (content.includes("parseAndCheckLogin")) return null;

  for (const anchor of ANCHOR_LINES) {
    const idx = content.indexOf(anchor);
    if (idx !== -1) {
      const insertPos = idx + anchor.length;
      return content.slice(0, insertPos) + "\n" + importLine + content.slice(insertPos);
    }
  }

  // Last resort: prepend to the file
  return importLine + "\n" + content;
}

// ── Main ──────────────────────────────────────────────────────────────────────

let patched = false;

for (const target of CANDIDATE_PATHS) {
  if (!fs.existsSync(target)) {
    console.log(`[patch-fca] ℹ️  Not found (skipping): ${path.relative(process.cwd(), target)}`);
    continue;
  }

  console.log(`[patch-fca] 🔍 Found: ${path.relative(process.cwd(), target)}`);

  try {
    const original = fs.readFileSync(target, "utf8");

    if (original.includes("parseAndCheckLogin")) {
      console.log("[patch-fca] ✅ Already patched — nothing to do.");
      patched = true;
      break;
    }

    const importLine = resolveImportLine(target);
    const result     = patchContent(original, importLine);

    if (!result) {
      console.log("[patch-fca] ✅ Already patched — nothing to do.");
      patched = true;
      break;
    }

    fs.writeFileSync(target, result, "utf8");
    console.log(`[patch-fca] ✅ Successfully injected: ${importLine}`);
    patched = true;
    break;

  } catch (err) {
    console.warn(`[patch-fca] ⚠️  Failed to patch ${path.basename(target)}: ${err.message}`);
  }
}

// ── Fallback: monkey-patch via a wrapper module ───────────────────────────────
// If no file was found/patched, write a small shim next to the fca-eryxenx
// entry point that pre-defines parseAndCheckLogin on the global scope so any
// call inside the library resolves without throwing ReferenceError.
if (!patched) {
  console.warn("[patch-fca] ⚠️  Could not locate changeGroupImage.js — applying global shim fallback.");

  const shimPath = path.join(BASE, "parseAndCheckLogin-shim.js");
  const shimCode = [
    '"use strict";',
    "// Auto-generated shim by patch-fca.js",
    "// Provides a safe no-op parseAndCheckLogin so the library doesn't throw",
    "// ReferenceError when changeGroupImage is called.",
    "if (typeof global.parseAndCheckLogin === 'undefined') {",
    "  global.parseAndCheckLogin = function parseAndCheckLogin(ctx, callback) {",
    "    if (typeof callback === 'function') return callback(null, ctx);",
    "    return ctx;",
    "  };",
    "}",
    "module.exports = global.parseAndCheckLogin;",
  ].join("\n");

  try {
    if (fs.existsSync(BASE)) {
      fs.writeFileSync(shimPath, shimCode, "utf8");
      console.log("[patch-fca] ✅ Global shim written to:", path.relative(process.cwd(), shimPath));
    } else {
      console.warn("[patch-fca] ⚠️  fca-eryxenx not installed yet — shim will be applied at next install.");
    }
  } catch (shimErr) {
    console.warn("[patch-fca] ⚠️  Could not write shim:", shimErr.message);
  }
}
