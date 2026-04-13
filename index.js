require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const FormData = require("form-data");
const { chat } = require("./ai");
const { getUser, saveUser } = require("./firebase");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

async function transcribeVoice(mediaUrl, accountSid, authToken) {
  try {
    // Download voice file from Twilio
    const audioResponse = await axios.get(mediaUrl, {
      responseType: "arraybuffer",
      auth: { username: accountSid, password: authToken }
    });

    // Send to Groq Whisper for transcription
    const formData = new FormData();
    formData.append("file", Buffer.from(audioResponse.data), {
      filename: "audio.ogg",
      contentType: "audio/ogg"
    });
    formData.append("model", "whisper-large-v3");
    formData.append("language", "hi"); // Hindi/Hinglish

    const whisperResponse = await axios.post(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`
        }
      }
    );

    return whisperResponse.data.text;
  } catch (err) {
    console.error("Transcription error:", err.message);
    return null;
  }
}

app.post("/webhook", async (req, res) => {
  const phone = req.body.From?.replace(/\D/g, "") || "unknown";
  const mediaUrl = req.body.MediaUrl0;
  const mediaType = req.body.MediaContentType0;

  let message = req.body.Body || "";

  console.log(`📩 From ${phone}: ${message}`);
  console.log(`Media: ${mediaType} - ${mediaUrl}`);

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
      const twiml = `<Response><Message>❌ Voice message samajh nahi aaya. Please text mein likhein.</Message></Response>`;
      res.set("Content-Type", "text/xml");
      return res.send(twiml);
    }
  }

  if (!message) {
    res.set("Content-Type", "text/xml");
    return res.send(`<Response><Message>❓ Kuch samajh nahi aaya!</Message></Response>`);
  }

  // Load user data from Firebase
  const user = await getUser(phone);
  if (!user.stock) user.stock = {};
  if (!user.udhaar) user.udhaar = {};
  if (!user.sales) user.sales = [];
  if (!user.history) user.history = [];

  // Get AI reply
  const { reply, action } = await chat(message, user.history);

  // Update conversation history
  user.history.push({ role: "user", content: message });
  user.history.push({ role: "assistant", content: reply });
  if (user.history.length > 20) user.history = user.history.slice(-20);

  // Process action if detected
  if (action) {
    if (action.intent === "stock_add" && action.product && action.quantity) {
      const key = action.product.toLowerCase();
      user.stock[key] = (user.stock[key] || 0) + action.quantity;
    }
    else if (action.intent === "stock_sell" && action.product && action.quantity) {
      const key = action.product.toLowerCase();
      user.stock[key] = Math.max(0, (user.stock[key] || 0) - action.quantity);
      user.sales.push({ product: key, quantity: action.quantity, time: new Date().toISOString() });
    }
    else if (action.intent === "udhaar" && action.person && action.amount) {
      const key = action.person.toLowerCase();
      user.udhaar[key] = (user.udhaar[key] || 0) + action.amount;
    }
    else if (action.intent === "udhaar_paid" && action.person && action.amount) {
      const key = action.person.toLowerCase();
      user.udhaar[key] = Math.max(0, (user.udhaar[key] || 0) - action.amount);
    }
  }

  // Save to Firebase
  await saveUser(phone, {
    stock: user.stock,
    udhaar: user.udhaar,
    sales: user.sales,
    history: user.history,
    lastSeen: new Date().toISOString()
  });

  console.log("Reply:", reply);
  res.set("Content-Type", "text/xml");
  res.send(`<Response><Message>${reply}</Message></Response>`);
});

app.listen(3000, () => console.log("🚀 Server listening on http://localhost:3000"));