require("dotenv").config();

const SYSTEM_PROMPT = `You are ShopBot - a smart, friendly WhatsApp assistant for small shop owners in India.

You help with:
1. Stock management (adding/selling products)
2. Udhaar (credit) tracking
3. Business reports and balance
4. Business advice

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

When you detect an action, include a special JSON tag at the END of your reply:
<!--ACTION:{"intent":"stock_add","product":"maggi","quantity":10,"person":null,"amount":null}-->

Intent options:
- stock_add: product added to stock
- stock_sell: product sold
- udhaar: someone owes money
- udhaar_paid: someone paid back
- balance: user wants stock balance
- report: user wants full report
- advice: user wants business advice or suggestions
- chat: just conversation, no action needed

If information is missing, do NOT include the ACTION tag — just ask the question.`;

async function callGroq(systemPrompt, userMessage) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: 500
    })
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

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

async function getBusinessAdvice(stock, udhaar, sales) {
  const prompt = `You are a smart business advisor for a small shop in India.

Here is the shop's current data:
- Stock: ${JSON.stringify(stock)}
- Udhaar (pending payments): ${JSON.stringify(udhaar)}
- Recent Sales: ${JSON.stringify(sales.slice(-20))}

Give 3 short, actionable business tips in Hindi/Hinglish based on this real data.
Examples:
- "Chips ka stock khatam ho raha hai, jaldi order karo!"
- "Ramesh ka ₹500 udhaar zyada din se pending hai"
- "Maggi sabse zyada bik raha hai, double stock rakho"

Be specific using their actual data. Use emojis. Keep each tip under 20 words.
Format: just 3 bullet points, nothing else.`;

  return await callGroq(prompt, "give advice now");
}

module.exports = { chat, getBusinessAdvice };