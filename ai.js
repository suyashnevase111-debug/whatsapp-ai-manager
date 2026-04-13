require("dotenv").config();

const SYSTEM_PROMPT = `You are a smart business assistant for small shop owners in India.
Parse the user's WhatsApp message and return a JSON object:
{"intent": one of ["stock_add","stock_sell","udhaar","unknown"],"product": string or null,"quantity": number or null,"person": string or null,"amount": number or null}
Always respond ONLY with raw JSON. No explanation. No markdown. No backticks.`;

async function analyzeMessage(message) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: SYSTEM_PROMPT + "\n\nMessage: " + message }] }]
      }),
    }
  );

  const data = await response.json();
  console.log("Raw API response:", JSON.stringify(data, null, 2));

  if (!data.candidates || !data.candidates[0]) {
    console.error("API Error:", data);
    return { intent: "unknown" };
  }

  const raw = data.candidates[0].content.parts[0].text.trim();

  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    console.error("Failed to parse:", raw);
    return { intent: "unknown" };
  }
}

module.exports = { analyzeMessage };