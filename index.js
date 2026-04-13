require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { chat } = require("./ai");
const { getUser, saveUser } = require("./firebase");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post("/webhook", async (req, res) => {
  const message = req.body.Body;
  const phone = req.body.From?.replace(/\D/g, "") || "unknown";
  console.log(`📩 From ${phone}: ${message}`);

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
      console.log("Stock updated:", user.stock);
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

  // Save updated user data to Firebase
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