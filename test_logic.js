const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function sendTelegramMessage(text, replyMarkup, targetChatId) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = targetChatId || process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error("Missing token or chatId");
    return;
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: "HTML", reply_markup: replyMarkup }),
  });
  if (!response.ok) {
    console.error("Failed:", await response.text());
  } else {
    console.log("Sent successfully to", chatId);
  }
}

async function main() {
  const taskId = 'cb1744e5-337e-468f-b3b8-34b4dc7e668d'; // Task with Kevin Owen and David
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  
  const executorNames = task.executor ? task.executor.split(",").map(n => n.trim()).filter(Boolean) : [];
  const users = await prisma.user.findMany({ where: { name: { in: executorNames } } });
  
  console.log("Executors:", executorNames);
  console.log("Users found:", users.map(u => u.name));

  const text = `🚨 <b>PENGINGAT (REMINDER) PROJECT TASK</b> 🚨\n\nTask: ${task.title}`;
  
  for (const u of users) {
    if (u.telegramChatId) {
      console.log(`Attempting to send DM to ${u.name} (${u.telegramChatId})...`);
      const dmText = `Halo ${u.name},\n\nAnda mendapatkan panggilan manual (PENGINGAT) dari Admin untuk Task berikut:\n\n${text}`;
      await sendTelegramMessage(dmText, undefined, u.telegramChatId);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
