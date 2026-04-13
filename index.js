require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cron = require("node-cron");
const twilio = require("twilio");
const axios = require("axios");
const FormData = require("form-data");
const path = require("path");
const { chat, getBusinessAdvice } = require("./ai");
const { getUser, saveUser, getAllUsers } = require("./firebase");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// ⏰ Udhaar Auto Reminder — every day at 9 AM IST
cron.schedule("0 9 * * *", async () => {
  console.log("⏰ Running udhaar reminders...");
  try {
    const users = await getAllUsers();
    for (const user of users) {
      const udhaarList = Object.entries(user.udhaar || {}).filter(([, v]) => v > 0);
      if (udhaarList.length === 0) continue;
      const lines = udhaarList.map(([name, amount]) => `• ${name}: ₹${amount}`).join("\n");
      const message = `🔔 *Udhaar Reminder*\n\nAaj ke pending udhaar:\n${lines}\n\n💡 Inhe yaad dilana mat bhoolo!`;
      await twilioClient.messages.create({
        from: "whatsapp:" + process.env.TWILIO_WHATSAPP_NUMBER,
        to: "whatsapp:+" + user.phone,
        body: message
      });
      console.log(`✅ Reminder sent to ${user.phone}`);
    }
  } catch (err) {
    console.error("Reminder error:", err.message);
  }
}, { timezone: "Asia/Kolkata" });

// 🎙️ Voice Transcription
async function transcribeVoice(mediaUrl, accountSid, authToken) {
  try {
    const audioResponse = await axios.get(mediaUrl, {
      responseType: "arraybuffer",
      auth: { username: accountSid, password: authToken }
    });
    const formData = new FormData();
    formData.append("file", Buffer.from(audioResponse.data), {
      filename: "audio.ogg",
      contentType: "audio/ogg"
    });
    formData.append("model", "whisper-large-v3");
    formData.append("language", "hi");
    const whisperResponse = await axios.post(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      formData,
      { headers: { ...formData.getHeaders(), Authorization: `Bearer ${process.env.GROQ_API_KEY}` } }
    );
    return whisperResponse.data.text;
  } catch (err) {
    console.error("Transcription error:", err.message);
    return null;
  }
}

// 📩 WhatsApp Webhook
app.post("/webhook", async (req, res) => {
  const phone = req.body.From?.replace(/\D/g, "") || "unknown";
  const mediaUrl = req.body.MediaUrl0;
  const mediaType = req.body.MediaContentType0;
  let message = req.body.Body || "";
  console.log(`📩 From ${phone}: ${message}`);

  // Handle voice message
  if (mediaUrl && mediaType && mediaType.includes("audio")) {
    console.log("🎙️ Voice message detected!");
    const transcript = await transcribeVoice(
      mediaUrl,
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    if (transcript) {
      console.log("📝 Transcript:", transcript);
      message = `🎙️ Voice: "${transcript}"`;
    } else {
      res.set("Content-Type", "text/xml");
      return res.send(`<Response><Message>❌ Voice message samajh nahi aaya. Please text mein likhein.</Message></Response>`);
    }
  }

  if (!message) {
    res.set("Content-Type", "text/xml");
    return res.send(`<Response><Message>❓ Kuch samajh nahi aaya!</Message></Response>`);
  }

  // Load user from Firebase
  const user = await getUser(phone);
  if (!user.stock) user.stock = {};
  if (!user.udhaar) user.udhaar = {};
  if (!user.sales) user.sales = [];
  if (!user.history) user.history = [];

  // Get AI reply
  const { reply, action } = await chat(message, user.history);

  // Update history
  user.history.push({ role: "user", content: message });
  user.history.push({ role: "assistant", content: reply });
  if (user.history.length > 20) user.history = user.history.slice(-20);

  // 🤖 Business Advice — special handler
  if (action && (action.intent === "advice" || action.intent === "suggest")) {
    const advice = await getBusinessAdvice(user.stock, user.udhaar, user.sales);
    await saveUser(phone, {
      stock: user.stock,
      udhaar: user.udhaar,
      sales: user.sales,
      history: user.history,
      phone: phone,
      lastSeen: new Date().toISOString()
    });
    res.set("Content-Type", "text/xml");
    return res.send(`<Response><Message>🤖 *AI Business Advice*\n\n${advice}</Message></Response>`);
  }

  // Process other actions
  if (action) {
    if (action.intent === "stock_add" && action.product && action.quantity) {
      const key = action.product.toLowerCase();
      user.stock[key] = (user.stock[key] || 0) + action.quantity;
      console.log("Stock updated:", user.stock);
    }
    else if (action.intent === "stock_sell" && action.product && action.quantity) {
      const key = action.product.toLowerCase();
      user.stock[key] = Math.max(0, (user.stock[key] || 0) - action.quantity);
      user.sales.push({ product: key, quantity: action.quantity, time: new Date().toISOString() });
      console.log("Stock sold:", user.stock);

      // 📦 Low Stock Alert
      if (user.stock[key] <= 5) {
        try {
          await twilioClient.messages.create({
            from: "whatsapp:" + process.env.TWILIO_WHATSAPP_NUMBER,
            to: "whatsapp:+" + phone,
            body: `⚠️ *Low Stock Alert!*\n\n📦 ${action.product} sirf ${user.stock[key]} bacha hai!\n\n🛒 Jaldi order karo!`
          });
          console.log("⚠️ Low stock alert sent!");
        } catch (err) {
          console.error("Low stock alert error:", err.message);
        }
      }
    }
    else if (action.intent === "udhaar" && action.person && action.amount) {
      const key = action.person.toLowerCase();
      user.udhaar[key] = (user.udhaar[key] || 0) + action.amount;
      console.log("Udhaar updated:", user.udhaar);
    }
    else if (action.intent === "udhaar_paid" && action.person && action.amount) {
      const key = action.person.toLowerCase();
      user.udhaar[key] = Math.max(0, (user.udhaar[key] || 0) - action.amount);
      console.log("Udhaar paid:", user.udhaar);
    }
  }

  // Save to Firebase
  await saveUser(phone, {
    stock: user.stock,
    udhaar: user.udhaar,
    sales: user.sales,
    history: user.history,
    phone: phone,
    lastSeen: new Date().toISOString()
  });

  res.set("Content-Type", "text/xml");
  res.send(`<Response><Message>${reply}</Message></Response>`);
});

// 📊 Dashboard
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});

app.get("/api/stats", async (req, res) => {
  try {
    const users = await getAllUsers();
    const merged = { stock: {}, udhaar: {}, sales: [] };
    for (const user of users) {
      Object.entries(user.stock || {}).forEach(([k, v]) => {
        merged.stock[k] = (merged.stock[k] || 0) + v;
      });
      Object.entries(user.udhaar || {}).forEach(([k, v]) => {
        merged.udhaar[k] = (merged.udhaar[k] || 0) + v;
      });
      merged.sales.push(...(user.sales || []));
    }
    res.json(merged);
  } catch (err) {
    res.json({ stock: {}, udhaar: {}, sales: [] });
  }
});

app.listen(3000, () => console.log("🚀 Server listening on http://localhost:3000"));