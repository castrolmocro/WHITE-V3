/**
 * patch-fca.js — يُصلح ملف changeGroupImage.js في fca-eryxenx
 * يُستدعى تلقائياً بعد كل npm install عبر postinstall
 */
"use strict";

const fs   = require("fs");
const path = require("path");

const TARGET = path.join(
  __dirname, "..",
  "node_modules", "fca-eryxenx", "src", "api", "messaging", "changeGroupImage.js"
);

const IMPORT_LINE = 'const { parseAndCheckLogin } = require("../../utils/client");';
const AFTER_LINE  = 'const log = require("../../../func/logAdapter");';

try {
  if (!fs.existsSync(TARGET)) {
    console.warn("[patch-fca] ⚠️  الملف غير موجود:", TARGET);
    process.exit(0);
  }

  const content = fs.readFileSync(TARGET, "utf8");

  if (content.includes("parseAndCheckLogin")) {
    console.log("[patch-fca] ✅  مُصلَح مسبقاً — لا شيء للفعل.");
    process.exit(0);
  }

  const idx = content.indexOf(AFTER_LINE);
  if (idx === -1) {
    // fallback: أضف بعد "use strict";
    const patched = content.replace('"use strict";', `"use strict";\n\n${IMPORT_LINE}`);
    fs.writeFileSync(TARGET, patched, "utf8");
  } else {
    const insertPos = idx + AFTER_LINE.length;
    const patched = content.slice(0, insertPos) + "\n" + IMPORT_LINE + content.slice(insertPos);
    fs.writeFileSync(TARGET, patched, "utf8");
  }

  console.log("[patch-fca] ✅  تم إضافة import parseAndCheckLogin بنجاح.");
} catch (e) {
  console.warn("[patch-fca] ⚠️  فشل التصحيح:", e.message);
  process.exit(0); // لا نوقف npm install عند الفشل
}
