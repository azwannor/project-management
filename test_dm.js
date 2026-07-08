async function testDM() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = '1318327114'; // Kevin Owen
  
  const text = `🚨 <b>PENGINGAT (REMINDER) PROJECT TASK</b> 🚨\n\n` +
      `Task ini membutuhkan perhatian Anda karena status masih <b>In Progress</b>.\n\n` +
      `📝 <b>Task:</b> Test Task\n` +
      `⏰ <b>Target Selesai (End Date):</b> 01 Jul 2026 12:00\n\n` +
      `Mohon segera dicek dan diselesaikan, @kvinown! 🙏`;
      
  const dmText = `Halo Kevin Owen,\n\nAnda mendapatkan panggilan manual (PENGINGAT) dari Admin untuk Task berikut:\n\n${text}`;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: dmText,
        parse_mode: "HTML",
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error("Gagal mengirim Telegram message:", errorData);
    } else {
      console.log("Pesan format dmText berhasil terkirim ke Kevin!");
    }
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

testDM();
