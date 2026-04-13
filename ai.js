require("dotenv").config();

const SYSTEM_PROMPT = `You are a smart business assistant for small shop owners in India.
Parse the WhatsApp message and return ONLY a JSON object:

{"intent":"stock_add","product":"apples","quantity":5,"person":null,"amount":null,"language":"english"}

Intent rules:
- stock_add: adding/received stock. e.g. "add 5 apples", "10 maggi aaya"
- stock_sell: sold something. e.g. "sold 3 mangoes", "becha 2 kg rice"
- udhaar: someone owes money. e.g. "udhaar 500 from Raju", "Ramesh ko 500 udhaar diya"
- udhaar_paid: someone paid back. e.g. "Raju ne 200 diya", "Ramesh paid 300"
- balance: check stock. e.g. "balance", "kitna stock hai"
- report: summary. e.g. "report", "aaj ka summary"
- unknown: anything else

Language detection:
- Hindi/Hinglish → language: "hindi"
- English → language: "english"
- Marathi → language: "marathi"

Return ONLY JSON. No markdown. No explanation.`;

async function analyzeMessage(message) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message }
      ],
      temperature: 0,
      max_tokens: 200
    })
  });

  const data = await response.json();
  console.log("Groq response:", JSON.stringify(data, null, 2));

  if (!data.choices || !data.choices[0]) {
    console.error("API Error:", data);
    return { intent: "unknown", language: "hindi" };
  }

  const raw = data.choices[0].message.content.trim();
  console.log("Raw text:", raw);

  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    console.error("Failed to parse:", raw);
    return { intent: "unknown", language: "hindi" };
  }
}

module.exports = { analyzeMessage };