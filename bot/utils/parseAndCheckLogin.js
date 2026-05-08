"use strict";

/**
 * bot/utils/parseAndCheckLogin.js
 *
 * Runtime fallback for parseAndCheckLogin.
 *
 * fca-eryxenx/src/api/messaging/changeGroupImage.js calls
 * parseAndCheckLogin(ctx, http) but does not import it.
 * scripts/patch-fca.js injects the real import at install time;
 * this file is a belt-and-suspenders safety net in case the patch
 * hasn't run yet (e.g. first cold boot before postinstall fires).
 *
 * CRITICAL — the real parseAndCheckLogin(ctx, http) returns an
 * ASYNC FUNCTION that acts as a .then() handler:
 *
 *   .then(parseAndCheckLogin(ctx, defaultFuncs))
 *   .then(resData => { return resData.payload.metadata[0]; })
 *
 * A shim that returns a plain value (like ctx) breaks the promise
 * chain — the upload response gets replaced by the shim's return
 * value, making resData.payload undefined, which causes:
 *   "Cannot read properties of undefined (reading 'metadata')"
 *
 * This shim mirrors the real signature exactly:
 *   parseAndCheckLogin(ctx, http, retryCount?) → async (res) → parsed
 */

if (typeof global.parseAndCheckLogin === "undefined") {
  global.parseAndCheckLogin = function parseAndCheckLogin(ctx, http, retryCount = 0) {
    return async function handleResponse(res) {
      const body = res?.data;
      if (body == null) return body;
      if (typeof body === "object") return body;
      try {
        const clean = String(body).replace(/^[^{[]*/, "");
        return JSON.parse(clean);
      } catch (_) {
        return body;
      }
    };
  };
}

module.exports = global.parseAndCheckLogin;
