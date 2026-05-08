module.exports = {
  config: {
    name: "ping",
    aliases: ["pong", "latency"],
    version: "1.0",
    author: "DJAMEL",
    countDown: 3,
    role: 0,
    shortDescription: "يقيس زمن استجابة البوت",
    longDescription: "يرسل رسالة ويقيس الوقت المستغرق للرد — مفيد لاختبار اتصال البوت وسرعة استجابته",
    category: "utility",
    guide: { en: "  {pn}ping" }
  },

  onStart: async function ({ api, event, message }) {
    const { threadID, messageID } = event;
    const start = Date.now();

    try {
      await message.reply("🏸 جارٍ القياس...");
      const elapsed = Date.now() - start;

      const uptime = process.uptime();
      const h = Math.floor(uptime / 3600);
      const m = Math.floor((uptime % 3600) / 60);
      const s = Math.floor(uptime % 60);
      const uptimeStr = `${h}س ${m}د ${s}ث`;

      const mem = process.memoryUsage();
      const memMB = Math.round(mem.rss / 1024 / 1024);

      const cmdsCount = global.GoatBot?.commands?.size || 0;

      return message.reply(
        `🏸 بونغ!\n\n` +
        `⚡ زمن الاستجابة: ${elapsed} مللي ثانية\n` +
        `🕐 وقت التشغيل: ${uptimeStr}\n` +
        `💾 الذاكرة: ${memMB} MB\n` +
        `📦 الأوامر المحملة: ${cmdsCount}\n` +
        `✅ البوت يعمل بشكل طبيعي`
      );
    } catch (e) {
      return message.reply(`❌ خطأ: ${e.message}`);
    }
  }
};