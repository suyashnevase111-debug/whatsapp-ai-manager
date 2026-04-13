const express = require("express");
const extractData = require("./ai");

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.post("/webhook", async (req, res) => {
  const message = req.body.Body;

  console.log("Incoming:", message);

  const result = await extractData(message);

  console.log("AI Output:", result);

  let reply = "";

  if (result.intent === "stock_add") {
    reply = `✅ Added ${result.quantity} ${result.product}`;
  } 
  else if (result.intent === "stock_sell") {
    reply = `🛒 Sold ${result.quantity} ${result.product}`;
  } 
  else if (result.intent === "udhaar") {
    reply = `💰 ${result.person} owes ₹${result.amount}`;
  } 
  else {
    reply = "❓ Didn't understand";
  }

  res.set("Content-Type", "text/xml");
  res.send(`<Response><Message>${reply}</Message></Response>`);
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});