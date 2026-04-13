require("dotenv").config();

const SYSTEM_PROMPT = `You are a business assistant. Parse the WhatsApp message and return ONLY a JSON object with no extra text:
{"intent":"stock_add","product":"apples","quantity":5,"person":null,"amount":null}

Intent rules:
- stock_add: adding/received stock. e.g. "add 5 apples", "10 maggi aaya"
- stock_sell: sold something. e.g. "sold 3 mangoes", "becha 2 kg rice"  
- udhaar: someone owes money. e.g. "udhaar 500 from Raju", "Ramesh ko 500 diya"
- unknown: anything else

Return ONLY the JSON. No markdown. No explanation. No backticks.`;

async function analyzeMessage(message) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: SYSTEM_PROMPT + "\n\nMessage: " + message }] }],
      generationConfig: { temperature: 0 }
    }),
  });

  const data = await response.json();
  console.log("Raw API response:", JSON.stringify(data, null, 2));

  if (!data.candidates || !data.candidates[0]) {
    console.error("API Error:", data);
    return { intent: "unknown" };
  }

  const raw = data.candidates[0].content.parts[0].text.trim();
  console.log("Raw text:", raw);

  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    console.error("Failed to parse:", raw);
    return { intent: "unknown" };
  }
}

module.exports = { analyzeMessage };