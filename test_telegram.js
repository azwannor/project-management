async function testTelegram() {
  const token = "8682747089:AAFKCnm7GwbdKgWP5AI0KaZqULYocOTDurU";
  const chatId = "-1004489877706";

  console.log("Token:", token.substring(0, 10) + "...");
  console.log("Chat ID:", chatId);

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: "🚨 <b>TEST MESSAGE</b> 🚨\n\nThis is a test message from the IT Tracker system.",
        parse_mode: "HTML",
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Failed to send Telegram message:", errorData);
    } else {
      console.log("Message sent successfully!");
    }
  } catch (error) {
    console.error("Error sending Telegram message:", error);
  }
}

testTelegram();
