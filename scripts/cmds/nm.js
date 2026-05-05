/**
 * /nm — Name Lock with time-based recurring enforcement
 *
 * /nm [name]          — lock group name
 * /unm                — unlock
 * /nm time [s]        — fixed interval (e.g. /nm time 30)
 * /nm time [min] [max]— random range  (e.g. /nm time 20 40)
 * /nm status          — show current settings
 *
 * البوت سيغير الاسم فقط حسب الوقت، وليس مباشرة عند تغييره
 */

if (!global._nmIntervals) global._nmIntervals = new Map();
if (!global._nmLocks)     global._nmLocks     = new Map();

const intervals = global._nmIntervals;
const locks     = global._nmLocks;

function isBotAdmin(senderID) {
  const adminBot = global.GoatBot?.config?.adminBot || [];
  return adminBot.map(id => String(id).trim()).includes(String(senderID));
}

function randBetween(min, max) {
  if (min >= max) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getIntervalMs(lock) {
  const min = lock.minDelay ?? lock.delay ?? 30;
  const max = lock.maxDelay ?? min;
  return randBetween(min, max) * 1000;
}

function startInterval(threadID, lock) {
  stopInterval(threadID);

  if (!lock?.enabled || !lock?.name) return;

  locks.set(threadID, lock);

  function schedule() {
    const delayMs = getIntervalMs(lock);
    const t = setTimeout(async () => {
      intervals.delete(threadID);

      const currentLock = locks.get(threadID);
      if (!currentLock?.enabled || !currentLock?.name) return;

      const api = global.GoatBot?.fcaApi;
      if (!api) { schedule(); return; }

      try {
        await api.setTitle(currentLock.name, threadID);
      } catch (_) {}

      schedule();
    }, delayMs);

    intervals.set(threadID, t);
  }

  schedule();
}

function stopInterval(threadID) {
  if (intervals.has(threadID)) {
    clearTimeout(intervals.get(threadID));
    intervals.delete(threadID);
  }
  locks.delete(threadID);
}

// ─── Module ─────────────────────────────────────────────

module.exports = {
  config: {
    name: "nm",
    version: "3.1",
    author: "Custom Edit",
    countDown: 5,
    role: 0,
    description: "قفل اسم الغروب مع تطبيق دوري فقط (بدون تغيير فوري)",
    category: "group",
    guide: {
      en:
        "  {pn} [name]           — Lock group name\n" +
        "  /unm                  — Unlock group name\n" +
        "  {pn} time [s]         — Fixed interval\n" +
        "  {pn} time [min] [max] — Random interval\n" +
        "  {pn} status           — Show settings"
    }
  },

  onStart: async function ({ api, event, args, message, threadsData }) {
    const { senderID, threadID } = event;
    if (!isBotAdmin(senderID)) return;

    const sub = (args[0] || "").toLowerCase();

    // ── status ──
    if (sub === "status") {
      const lock = await threadsData.get(threadID, "data.nmLock");
      if (!lock?.name) {
        return message.reply("📋 قفل الاسم مُعطَّل.");
      }

      const min = lock.minDelay ?? lock.delay ?? 30;
      const max = lock.maxDelay ?? min;
      const delayStr = min === max ? `${min}s` : `${min}–${max}s`;

      return message.reply(
        `📋 الحالة\n━━━━━━━━━━\n` +
        `🔒 ${lock.enabled ? "مفعل" : "معطل"}\n` +
        `📛 ${lock.name}\n` +
        `⏱ ${delayStr}`
      );
    }

    // ── time ──
    if (sub === "time") {
      const v1 = parseInt(args[1]);
      const v2 = parseInt(args[2]);

      if (isNaN(v1) || v1 < 1) {
        return message.reply("❌ مثال: /nm time 30 أو /nm time 20 40");
      }

      const current = await threadsData.get(threadID, "data.nmLock") || {};
      if (!current.name) {
        return message.reply("❌ لازم تقفل اسم أولاً.");
      }

      current.minDelay = v1;
      current.maxDelay = (!isNaN(v2) && v2 >= v1) ? v2 : v1;
      current.delay = v1;

      await threadsData.set(threadID, current, "data.nmLock");
      startInterval(threadID, current);

      return message.reply("✅ تم تحديث الوقت.");
    }

    // ── set name ──
    const name = args.join(" ").trim();
    if (!name) {
      return message.reply("❌ اكتب اسم بعد /nm");
    }

    const existing = await threadsData.get(threadID, "data.nmLock") || {};

    const newLock = {
      name,
      delay: existing.minDelay ?? 30,
      minDelay: existing.minDelay ?? 30,
      maxDelay: existing.maxDelay ?? 30,
      enabled: true
    };

    await threadsData.set(threadID, newLock, "data.nmLock");
    startInterval(threadID, newLock);

    return message.reply("🔒 تم قفل الاسم بنجاح.");
  },

  // ❌ هنا التعديل: لا تغيير فوري
  onEvent: async function ({ event, threadsData }) {
    const { threadID, logMessageType } = event;
    if (logMessageType !== "log:thread-name") return;

    let nmLock;
    try {
      nmLock = await threadsData.get(threadID, "data.nmLock");
    } catch (_) { return; }

    if (!nmLock?.enabled || !nmLock?.name) return;

    // فقط إعادة تشغيل المؤقت لو لم يكن شغال
    if (!locks.has(threadID)) {
      locks.set(threadID, nmLock);
      startInterval(threadID, nmLock);
    }

    // 🚫 لا يوجد setTitle هنا => لا تغيير فوري
  }
};
