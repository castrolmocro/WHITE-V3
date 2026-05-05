const fs   = require("fs-extra");
const path = require("path");

const dataPath = path.join(process.cwd(), "database/data/angelData.json");

// ─── Persistence ─────────────────────────────────────────────────────────────

function loadData() {
  try {
    if (fs.existsSync(dataPath)) return JSON.parse(fs.readFileSync(dataPath, "utf8"));
  } catch (e) {}
  return {};
}

function saveData(data) {
  fs.ensureDirSync(path.dirname(dataPath));
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

// ─── Admin check ─────────────────────────────────────────────────────────────

function isBotAdmin(senderID) {
  const adminBot = global.GoatBot.config.adminBot || [];
  return adminBot.includes(String(senderID)) || adminBot.includes(senderID);
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
  await api.sendMessage(msg, threadID);
}

// ─── Global state ─────────────────────────────────────────────────────────────

if (!global.GoatBot.angelIntervals) {
  global.GoatBot.angelIntervals = {};
}

// ─── Random delay helper ─────────────────────────────────────────────────────

function randBetween(minS, maxS) {
  if (minS >= maxS) return minS;
  return minS + Math.random() * (maxS - minS);
}

function getAngelDelayMs(threadData) {
  const min = threadData.minSeconds ?? threadData.intervalSeconds ?? 60;
  const max = threadData.maxSeconds ?? min;
  return Math.round(randBetween(min, max) * 1000);
}

// ─── Self-rescheduling timer ──────────────────────────────────────────────────

function scheduleAngel(api, threadID) {
  const data = loadData();
  const td   = data[threadID];
  if (!td || !td.active || !td.message) {
    delete global.GoatBot.angelIntervals[threadID];
    return;
  }

  const delayMs = getAngelDelayMs(td);

  const t = setTimeout(async () => {
    const freshData = loadData();
    const freshTd   = freshData[threadID];
    if (!freshTd || !freshTd.active || !freshTd.message) {
      delete global.GoatBot.angelIntervals[threadID];
      return;
    }
    try {
      await humanTypeSend(api, threadID, freshTd.message);
    } catch (_) {}
    scheduleAngel(api, threadID);
  }, delayMs);

  global.GoatBot.angelIntervals[threadID] = t;
}

// ─── Restore on restart ───────────────────────────────────────────────────────

function restoreIntervals(api) {
  if (global.GoatBot.angelRestored) return;
  global.GoatBot.angelRestored = true;

  const data   = loadData();
  let restored = 0;

  for (const [threadID, threadData] of Object.entries(data)) {
    if (threadData.active && threadData.message && !global.GoatBot.angelIntervals[threadID]) {
      scheduleAngel(api, threadID);
      restored++;
    }
  }

  if (restored > 0) {
    global.utils.log.info("ANGEL", `✅ Restored ${restored} auto-send timer(s) after restart`);
  }
}

// ─── Command ──────────────────────────────────────────────────────────────────

module.exports = {
  config: {
    name:        "angel",
    version:     "2.0",
    author:      "Custom",
    countDown:   3,
    role:        0,
    description: "يرسل رسالة تلقائياً بفترة زمنية عشوائية قابلة للضبط (بالثواني).",
    category:    "admin",
    guide: {
      en: "  {pn} on — تشغيل الإرسال التلقائي\n"
        + "  {pn} off — إيقاف الإرسال التلقائي\n"
        + "  {pn} change [رسالة] — تغيير الرسالة\n"
        + "  {pn} time [ثانية] — تحديد الفترة\n"
        + "  {pn} time [أدنى] [أقصى] — فترة عشوائية بين قيمتين\n"
        + "  {pn} status — عرض الحالة\n\n"
        + "مثال:\n"
        + "  /angel change مرحباً بالجميع!\n"
        + "  /angel time 30\n"
        + "  /angel time 5 15\n"
        + "  /angel on"
    }
  },

  onStart: async function ({ api, event, args, message }) {
    const { senderID, threadID } = event;

    if (!isBotAdmin(senderID)) return;

    restoreIntervals(api);

    const action     = args[0]?.toLowerCase();
    const data       = loadData();

    if (!data[threadID]) {
      data[threadID] = { message: null, minSeconds: 60, maxSeconds: 60, active: false };
    }

    const threadData = data[threadID];

    switch (action) {

      case "change": {
        const newMsg = args.slice(1).join(" ").trim();
        if (!newMsg) {
          return message.reply("❌ اكتب الرسالة بعد الأمر.\n\nمثال: /angel change مرحباً بالجميع!");
        }
        threadData.message = newMsg;
        saveData(data);
        if (global.GoatBot.angelIntervals[threadID] && threadData.active) {
          clearTimeout(global.GoatBot.angelIntervals[threadID]);
          delete global.GoatBot.angelIntervals[threadID];
          scheduleAngel(api, threadID);
        }
        return message.reply(`✅ تم تحديث الرسالة!\n\n📝 الرسالة الجديدة:\n"${newMsg}"`);
      }

      case "time": {
        const v1 = parseFloat(args[1]);
        const v2 = parseFloat(args[2]);

        if (isNaN(v1) || v1 <= 0) {
          return message.reply(
            "❌ مثال:\n"
            + "  /angel time 30       — كل 30 ثانية\n"
            + "  /angel time 5 15     — عشوائي بين 5 و15 ثانية"
          );
        }

        if (!isNaN(v2) && v2 >= v1) {
          threadData.minSeconds = v1;
          threadData.maxSeconds = v2;
        } else {
          threadData.minSeconds = v1;
          threadData.maxSeconds = v1;
        }

        // Backward-compat field
        threadData.intervalSeconds = v1;
        // Remove old minutes field
        delete threadData.intervalMinutes;

        saveData(data);

        if (global.GoatBot.angelIntervals[threadID]) {
          clearTimeout(global.GoatBot.angelIntervals[threadID]);
          delete global.GoatBot.angelIntervals[threadID];
          if (threadData.active && threadData.message) {
            scheduleAngel(api, threadID);
          }
        }

        const delayStr = threadData.minSeconds === threadData.maxSeconds
          ? `${threadData.minSeconds} ثانية`
          : `عشوائي بين ${threadData.minSeconds}–${threadData.maxSeconds} ثانية`;

        return message.reply(
          `✅ تم تحديث الفترة الزمنية!\n\n⏱️ الفترة الجديدة: ${delayStr}`
          + (threadData.active ? "\n♻️ تم إعادة تشغيل المؤقت." : "")
        );
      }

      case "on": {
        if (!threadData.message) {
          return message.reply("❌ لم تحدد الرسالة بعد.\n\nحددها أولاً:\n/angel change [رسالتك]");
        }

        if (global.GoatBot.angelIntervals[threadID]) {
          return message.reply("⚠️ Angel يعمل بالفعل في هذا الغروب.");
        }

        threadData.active = true;
        saveData(data);

        scheduleAngel(api, threadID);

        const minS = threadData.minSeconds ?? 60;
        const maxS = threadData.maxSeconds ?? minS;
        const delayStr = minS === maxS
          ? `${minS} ثانية`
          : `عشوائي بين ${minS}–${maxS} ثانية`;

        return message.reply(
          `✅ تم تشغيل Angel!\n\n`
          + `📝 الرسالة: "${threadData.message}"\n`
          + `⏱️ الفترة: كل ${delayStr}\n`
          + `✍️ محاكاة الكتابة البشرية: مفعّلة`
        );
      }

      case "off": {
        if (!global.GoatBot.angelIntervals[threadID]) {
          return message.reply("⚠️ Angel غير مفعّل في هذا الغروب.");
        }

        clearTimeout(global.GoatBot.angelIntervals[threadID]);
        delete global.GoatBot.angelIntervals[threadID];

        threadData.active = false;
        saveData(data);

        return message.reply("✅ تم إيقاف Angel في هذا الغروب.");
      }

      case "status": {
        const isRunning = !!global.GoatBot.angelIntervals[threadID];
        const minS = threadData.minSeconds ?? threadData.intervalSeconds ?? 60;
        const maxS = threadData.maxSeconds ?? minS;
        const delayStr = minS === maxS
          ? `${minS} ثانية`
          : `عشوائي بين ${minS}–${maxS} ثانية`;
        return message.reply(
          `📊 حالة Angel — هذا الغروب\n\n`
          + `▪️ الحالة: ${isRunning ? "🟢 يعمل" : "🔴 موقوف"}\n`
          + `▪️ الرسالة: ${threadData.message ? `"${threadData.message}"` : "غير محددة"}\n`
          + `▪️ الفترة: ${delayStr}\n`
          + `▪️ محاكاة الكتابة: ✍️ مفعّلة`
        );
      }

      default: {
        return message.reply(
          "📖 أوامر Angel:\n\n"
          + "/angel change [رسالة] — تحديد الرسالة\n"
          + "/angel time [ثانية] — تحديد الفترة\n"
          + "/angel time [أدنى] [أقصى] — فترة عشوائية\n"
          + "/angel on — تشغيل الإرسال التلقائي\n"
          + "/angel off — إيقاف الإرسال التلقائي\n"
          + "/angel status — عرض الحالة الحالية"
        );
      }
    }
  }
};
