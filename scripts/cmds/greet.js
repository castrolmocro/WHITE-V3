// scripts/cmds/greet.js — generated via DevHub AI assistant (WHITE V3)
module.exports = {
  config: {
    name: "greet",
    aliases: ["hello", "hi"],
    version: "2.0",
    author: "DJAMEL",
    countDown: 5,
    role: 0,
    shortDescription: "يستقبل المستخدم بترحيب مخصص ويعرض أهم الأوامر",
    longDescription: "عند أول تفاعل مع البوت يرسل رسالة ترحيبية تتضمن معلومات عن WHITE V3 وأوامر مفيدة",
    category: "custom",
    guide: { en: "{pn}greet" }
  },

  onStart: async function ({ api, event, message }) {
    const { senderID } = event;
    let name = "صديقي";

    try {
      const info = await new Promise((resolve, reject) =>
        api.getUserInfo(senderID, (err, data) => err ? reject(err) : resolve(data))
      );
      name = info[senderID]?.name || name;
    } catch (e) {}

    const prefix = global.GoatBot?.config?.prefix ?? "/";

    const messageContent = `
🎉 مرحبًا ${name} 👋

أنا *WHITE V3*، البوت الذكي الذي يدير مجموعتك ويضيف المرح والوظائف المميزة! 🤖✨

إليك أهم الأوامر التي ستحب استخدامها:
• \`${prefix}help\` — قائمة بجميع الأوامر المتاحة
• \`${prefix}rank\` — مشاهدة مستواك ونقاطك
• \`${prefix}weather <مدينة>\` — توقعات الطقس
• \`${prefix}ban <مستخدم>\` — حظر عضو (للمشرفين)
• \`${prefix}kick <مستخدم>\` — طرد عضو (للمشرفين)
• \`${prefix}info\` — معلومات حسابك
• \`${prefix}stats\` — إحصاءات المجموعة
• \`${prefix}e2ee status\` — حالة التشفير

استمتع بالتفاعلات، وأخبرنا دائمًا بما تحتاج إليه! 🚀
`.trim();

    return message.reply(messageContent);
  }
};
