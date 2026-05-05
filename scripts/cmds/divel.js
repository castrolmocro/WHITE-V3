const fs   = require("fs-extra");
const path = require("path");

const dataPath = path.join(process.cwd(), "database/data/divelData.json");

// ─── Persistence ──────────────────────────────────────────────────────────────

function loadData() {
  try {
    if (fs.existsSync(dataPath)) return JSON.parse(fs.readFileSync(dataPath, "utf8"));
  } catch (_) {}
  return {};
}

function saveData(data) {
  fs.ensureDirSync(path.dirname(dataPath));
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

// ─── Global state ─────────────────────────────────────────────────────────────

if (!global.GoatBot.divelWatchers) {
  global.GoatBot.divelWatchers = {};
}

// ─── Human-typing simulation ──────────────────────────────────────────────────

async function humanTypeSend(api, threadID, msg) {
  try {
    const { calcHumanTypingDelay, simulateTyping } = global.utils;
    if (typeof calcHumanTypingDelay === "function" && typeof simulateTyping === "function") {
      await simulateTyping(api, threadID, calcHumanTypingDelay(msg));
    } else {
      const ms = Math.min(Math.max(msg.length * 60, 1200), 8000);
      await new Promise(r => setTimeout(r, ms));
    }
  } catch (_) {}
  await api.sendMessage({ body: msg, isDaydreamMode: true }, threadID);
}

// ─── استعادة الغروبات بعد إعادة التشغيل ────────────────────────────────────

function restoreWatchers() {
  if (global.GoatBot.divelRestored) return;
  global.GoatBot.divelRestored = true;

  const data    = loadData();
  let restored  = 0;

  for (const [threadID, td] of Object.entries(data)) {
    if (td.active && td.message) {
      global.GoatBot.divelWatchers[threadID] = {
        active:      true,
        message:     td.message,
        minSeconds:  td.minSeconds ?? (td.waitMinutes ? td.waitMinutes * 60 : 300),
        maxSeconds:  td.maxSeconds ?? (td.waitMinutes ? td.waitMinutes * 60 : 300),
        timer:       null
      };
      restored++;
    }
  }

  if (restored > 0 && global.utils?.log?.info) {
    global.utils.log.info("DIVEL", `✅ Restored ${restored} watcher(s) after restart`);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isBotAdmin(senderID) {
  const admins = global.GoatBot.config.adminBot || [];
  return admins.includes(String(senderID)) || admins.includes(senderID);
}

function randBetween(minS, maxS) {
  if (minS >= maxS) return minS;
  return minS + Math.random() * (maxS - minS);
}

function getWatcherDelayMs(watcher) {
  const min = watcher.minSeconds ?? 300;
  const max = watcher.maxSeconds ?? min;
  return Math.round(randBetween(min, max) * 1000);
}

// ─── Module ───────────────────────────────────────────────────────────────────

module.exports = {
  config: {
    name:             "divel",
    aliases:          ["devil", "ديفل"],
    version:          "2.0",
    author:           "Djamel",
    countDown:        3,
    role:             0,
    shortDescription: "يراقب الغروب ويرد بعد فترة صمت",
    longDescription:  "عكس Angel — يراقب المحادثة بصمت، فإذا أرسل أحد رسالة ينتظر N ثانية (عشوائية) من الصمت ثم يرد برسالته تلقائياً مع مؤشر كتابة بشري.",
    category:         "admin",
    guide: {
      en: "  {pn} on — تفعيل المراقبة\n"
        + "  {pn} off — إيقاف المراقبة\n"
        + "  {pn} change [رسالة] — تحديد الرسالة\n"
        + "  {pn} time [ثانية] — تحديد وقت الانتظار\n"
        + "  {pn} time [أدنى] [أقصى] — وقت انتظار عشوائي\n"
        + "  {pn} status — عرض الحالة\n\n"
        + "مثال:\n"
        + "  /divel change هيا تكلموا! 👿\n"
        + "  /divel time 60\n"
        + "  /divel time 30 120\n"
        + "  /divel on"
    }
  },

  // ─── يُستدعى عند كل رسالة في أي غروب ──────────────────────────────────────
  onChat: async function ({ api, event }) {
    const { threadID, senderID } = event;

    if (!event.body && !(event.attachments && event.attachments.length)) return;

    try {
      const botID = String(api.getCurrentUserID() || "");
      if (botID && String(senderID) === botID) return;
    } catch (_) {}

    restoreWatchers();

    const watcher = global.GoatBot.divelWatchers[threadID];
    if (!watcher || !watcher.active || !watcher.message) return;

    // إعادة ضبط المؤقت (debounce)
    if (watcher.timer) {
      clearTimeout(watcher.timer);
      watcher.timer = null;
    }

    const delayMs = getWatcherDelayMs(watcher);
    const tid     = threadID;
    const msg     = watcher.message;

    watcher.timer = setTimeout(async () => {
      const w = global.GoatBot.divelWatchers[tid];
      if (!w || !w.active) return;
      w.timer = null;

      try {
        await humanTypeSend(api, tid, msg);
      } catch (err) {
        global.utils?.log?.err?.("DIVEL", "Failed to send: " + err.message);
      }
    }, delayMs);
  },

  // ─── أوامر الإعداد ──────────────────────────────────────────────────────────
  onStart: async function ({ api, event, args, message }) {
    const { senderID, threadID } = event;

    if (!isBotAdmin(senderID)) return;

    restoreWatchers();

    const action = args[0]?.toLowerCase();
    const data   = loadData();

    if (!data[threadID]) {
      data[threadID] = { message: null, minSeconds: 300, maxSeconds: 300, active: false };
    }
    const td = data[threadID];

    switch (action) {

      case "change": {
        const newMsg = args.slice(1).join(" ").trim();
        if (!newMsg) return message.reply("اكتب الرسالة بعد الأمر.\n\nمثال: /divel change هيا تكلموا!");
        td.message = newMsg;
        saveData(data);
        if (global.GoatBot.divelWatchers[threadID]) {
          global.GoatBot.divelWatchers[threadID].message = newMsg;
        }
        return message.reply(`✅ تم حفظ الرسالة:\n"${newMsg}"`);
      }

      case "time": {
        const v1 = parseFloat(args[1]);
        const v2 = parseFloat(args[2]);

        if (isNaN(v1) || v1 <= 0) {
          return message.reply(
            "❌ مثال:\n"
            + "  /divel time 60        — انتظر 60 ثانية\n"
            + "  /divel time 30 120    — عشوائي بين 30 و120 ثانية"
          );
        }

        if (!isNaN(v2) && v2 >= v1) {
          td.minSeconds = v1;
          td.maxSeconds = v2;
        } else {
          td.minSeconds = v1;
          td.maxSeconds = v1;
        }

        // Remove old minutes field
        delete td.waitMinutes;
        saveData(data);

        const watcher = global.GoatBot.divelWatchers[threadID];
        if (watcher) {
          watcher.minSeconds = td.minSeconds;
          watcher.maxSeconds = td.maxSeconds;
          if (watcher.timer) { clearTimeout(watcher.timer); watcher.timer = null; }
        }

        const delayStr = td.minSeconds === td.maxSeconds
          ? `${td.minSeconds} ثانية`
          : `عشوائي بين ${td.minSeconds}–${td.maxSeconds} ثانية`;

        return message.reply(`✅ تم ضبط وقت الانتظار: ${delayStr}`);
      }

      case "on": {
        if (!td.message) return message.reply("حدد الرسالة أولاً:\n/divel change [رسالتك]");
        if (global.GoatBot.divelWatchers[threadID]?.active) return message.reply("⚠️ Divel مفعّل بالفعل.");

        td.active = true;
        saveData(data);

        const minS = td.minSeconds ?? 300;
        const maxS = td.maxSeconds ?? minS;

        global.GoatBot.divelWatchers[threadID] = {
          active:     true,
          message:    td.message,
          minSeconds: minS,
          maxSeconds: maxS,
          timer:      null
        };

        const delayStr = minS === maxS
          ? `${minS} ثانية`
          : `عشوائي بين ${minS}–${maxS} ثانية`;

        return message.reply(
          `✅ تم تفعيل Divel!\n\n`
          + `📝 الرسالة: "${td.message}"\n`
          + `⏱️ الانتظار: ${delayStr} من الصمت\n`
          + `✍️ مؤشر الكتابة البشري: مفعّل`
        );
      }

      case "off": {
        const watcher = global.GoatBot.divelWatchers[threadID];
        if (!watcher?.active) return message.reply("⚠️ Divel غير مفعّل.");
        if (watcher.timer) clearTimeout(watcher.timer);
        delete global.GoatBot.divelWatchers[threadID];
        td.active = false;
        saveData(data);
        return message.reply("✅ تم إيقاف Divel.");
      }

      case "status": {
        const watcher = global.GoatBot.divelWatchers[threadID];
        const minS = td.minSeconds ?? 300;
        const maxS = td.maxSeconds ?? minS;
        const delayStr = minS === maxS
          ? `${minS} ثانية`
          : `عشوائي بين ${minS}–${maxS} ثانية`;
        return message.reply(
          `📊 حالة Divel — هذا الغروب\n\n`
          + `▪️ الحالة: ${watcher?.active ? "🟢 مفعّل" : "🔴 موقوف"}\n`
          + `▪️ الرسالة: ${td.message ? `"${td.message}"` : "غير محددة"}\n`
          + `▪️ وقت الانتظار: ${delayStr}\n`
          + `▪️ مؤشر الكتابة: ✍️ مفعّل دائماً`
        );
      }

      default:
        return message.reply(
          "📖 أوامر Divel:\n\n"
          + "/divel change [رسالة] — تحديد الرسالة\n"
          + "/divel time [ثانية] — تحديد وقت الانتظار\n"
          + "/divel time [أدنى] [أقصى] — وقت عشوائي\n"
          + "/divel on — تشغيل المراقبة\n"
          + "/divel off — إيقاف المراقبة\n"
          + "/divel status — عرض الحالة"
        );
    }
  }
};
