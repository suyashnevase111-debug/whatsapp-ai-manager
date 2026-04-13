require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { analyzeMessage } = require("./ai");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post("/webhook", async (req, res) => {
  const message = req.body.Body;
  console.log("Incoming:", message);

  const result = await analyzeMessage(message);
  console.log("AI Output:", result);

  let reply = "";

  if (result.intent === "stock_add") {
    reply = `✅ Added ${result.quantity} ${result.product}`;
  } else if (result.intent === "stock_sell") {
    reply = `🛒 Sold ${result.quantity} ${result.product}`;
  } else if (result.intent === "udhaar") {
    reply = `💰 ${result.person} owes ₹${result.amount}`;
  } else {
    reply = "❓ Didn't understand";
  }

  res.set("Content-Type", "text/xml");
  res.send(`<Response><Message>${reply}</Message></Response>`);
});

app.listen(3000, () => console.log("🚀 Server listening on http://localhost:3000"));