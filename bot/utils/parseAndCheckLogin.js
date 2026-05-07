/**
 * bot/utils/parseAndCheckLogin.js
 *
 * Fallback implementation of `parseAndCheckLogin` for cases where the
 * fca-eryxenx library's changeGroupImage.js is missing the import.
 *
 * The real function (inside fca-eryxenx/src/utils/client.js) validates that
 * the API context is properly authenticated before executing an API call.
 * This shim replicates the same call-signature so the library doesn't throw
 * a ReferenceError, while still forwarding the callback so the actual API
 * request proceeds normally.
 *
 * Usage (automatic — loaded by Goat.js before the bot starts):
 *   require("./bot/utils/parseAndCheckLogin");
 *
 * Or imported directly in any command that needs it:
 *   const parseAndCheckLogin = require("../../bot/utils/parseAndCheckLogin");
 */

"use strict";

/**
 * parseAndCheckLogin(ctx, callback)
 *
 * @param {object}   ctx      - The fca-eryxenx API context object.
 * @param {Function} callback - Node-style callback (err, result).
 * @returns {*} Whatever the callback returns, or ctx if no callback given.
 */
function parseAndCheckLogin(ctx, callback) {
  if (typeof callback === "function") {
    // Validate that the context looks like a live session before proceeding.
    if (!ctx || typeof ctx !== "object") {
      return callback(new Error("parseAndCheckLogin: invalid API context"), null);
    }
    return callback(null, ctx);
  }
  return ctx;
}

// ── Global shim ───────────────────────────────────────────────────────────────
// Register on the global object so that any fca-eryxenx module that calls
// parseAndCheckLogin without importing it (the bug) resolves correctly.
if (typeof global.parseAndCheckLogin === "undefined") {
  global.parseAndCheckLogin = parseAndCheckLogin;
}

module.exports = parseAndCheckLogin;
