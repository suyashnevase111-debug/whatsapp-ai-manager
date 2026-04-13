require("dotenv").config();

const SYSTEM_PROMPT = `You are ShopBot - a smart, friendly WhatsApp assistant for small shop owners in India.

You help with:
1. Stock management (adding/selling products)
2. Udhaar (credit) tracking
3. Business reports and balance

RULES:
- ALWAYS reply in the EXACT SAME LANGUAGE as the user's message
- If user writes Hindi → reply Hindi
- If user writes English → reply English
- If user writes Marathi → reply Marathi
- If user writes Bhojpuri → reply Bhojpuri
- If user writes Marvadi → reply Marvadi
- If user writes Hinglish → reply Hinglish

BEHAVIOR:
- Be conversational, friendly and smart like ChatGPT
- If something is unclear → ASK for clarification
- If user says just "maggi" without quantity → ask "Kitna maggi aaya? 😊"
- If user says "udhaar" without name → ask "Kisne liya udhaar? 🤔"
- Confirm every action with a friendly message
- Use emojis naturally
- Keep replies short and clear

STORE DATA FORMAT (use this to track):
When you detect an action, include a special JSON tag at the END of your reply:
<!--ACTION:{"intent":"stock_add","product":"maggi","quantity":10,"person":null,"amount":null}-->

Intent options:
- stock_add: product added to stock
- stock_sell: product sold
- udhaar: someone owes money
- udhaar_paid: someone paid back
- balance: user wants stock balance
- report: user wants full report
- chat: just conversation, no action needed

If information is missing, do NOT include the ACTION tag — just ask the question.`;

async function chat(message, history = []) {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: message }
  ];

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.7,
      max_tokens: 500
    })
  });

  const data = await response.json();
  console.log("Groq response:", JSON.stringify(data, null, 2));

  if (!data.choices?.[0]) {
    console.error("API Error:", data);
    return { reply: "Sorry, kuch problem hai. Thodi der baad try karo! 🙏", action: null };
  }

  const fullReply = data.choices[0].message.content.trim();
  console.log("Full reply:", fullReply);

  // Extract action from reply
  const actionMatch = fullReply.match(/<!--ACTION:(.*?)-->/s);
  let action = null;
  let cleanReply = fullReply.replace(/<!--ACTION:.*?-->/s, "").trim();

  if (actionMatch) {
    try {
      action = JSON.parse(actionMatch[1]);
    } catch {
      console.error("Failed to parse action");
    }
  }

  return { reply: cleanReply, action };
}

module.exports = { chat };