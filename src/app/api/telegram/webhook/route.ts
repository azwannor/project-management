import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Check if it's a callback query
    if (body.callback_query) {
      const callbackQuery = body.callback_query;
      const data = callbackQuery.data; // e.g., "done_support_12345"
      const message = callbackQuery.message; // Original message
      const telegramUsername = callbackQuery.from.username; // User who clicked (can be undefined)
      const telegramName = callbackQuery.from.first_name + (callbackQuery.from.last_name ? ` ${callbackQuery.from.last_name}` : "");

      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) {
        return NextResponse.json({ error: "Missing bot token" }, { status: 500 });
      }

      // 1. Answer callback query immediately to stop the loading spinner on the button
      await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQuery.id,
        }),
      });

      if (data && data.startsWith("done_support_")) {
        const ticketId = data.replace("done_support_", "");
        
        // 2. Resolve User
        let resolverName = telegramName;
        let userId = null;
        
        if (telegramUsername) {
          // find user by telegramUsername
          const user = await prisma.user.findFirst({
            where: { telegramUsername: telegramUsername }
          });
          
          if (user) {
            resolverName = user.name;
            userId = user.id;
          }
        }

        // 3. Process Ticket
        const ticket = await prisma.supportTicket.findUnique({
           where: { id: ticketId },
           include: { executors: true }
        });
        
        if (ticket && ticket.status !== "Done") {
          const existingExecutorIds = ticket.executors.map(e => e.id);
          const connectExecutors = userId && !existingExecutorIds.includes(userId) 
              ? { connect: [{ id: userId }] } 
              : undefined;

          const updatedSolution = ticket.solution 
            ? `${ticket.solution}\n\n[Diselesaikan otomatis via Telegram oleh ${resolverName}]` 
            : `[Diselesaikan otomatis via Telegram oleh ${resolverName}]`;

          await prisma.supportTicket.update({
            where: { id: ticketId },
            data: {
              status: "Done",
              endDate: new Date(),
              solution: updatedSolution,
              ...(connectExecutors ? { executors: connectExecutors } : {})
            }
          });

          // 4. Update Telegram Message
          const newText = message.text + `\n\n✅ <b>STATUS: SELESAI</b>\n<i>Diselesaikan oleh: ${resolverName}</i>`;
          await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: message.chat.id,
              message_id: message.message_id,
              text: newText,
              parse_mode: "HTML",
              reply_markup: { inline_keyboard: [] } // Remove buttons
            }),
          });
        }
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    // Return 200 anyway so Telegram stops retrying on logic errors
    return NextResponse.json({ success: true });
  }
}
