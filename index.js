require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { analyzeMessage } = require("./ai");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const store = {
  stock: {},
  udhaar: {},
  sales: []
};

function reply(lang, hi, en, mr) {
  if (lang === "hindi") return hi;
  if (lang === "marathi") return mr || hi;
  return en;
}

app.post("/webhook", async (req, res) => {
  const message = req.body.Body;
  console.log("Incoming:", message);

  const result = await analyzeMessage(message);
  console.log("AI Output:", result);

  const lang = result.language || "hindi";
  let replyText = "";

  if (result.intent === "stock_add") {
    const key = result.product?.toLowerCase();
    if (!key || !result.quantity) {
      replyText = reply(lang,
        "❓ Samajh nahi aaya. Try karo: '10 maggi aaya'",
        "❓ Didn't understand. Try: 'add 10 maggi'",
        "❓ Samajhla nahi. Try kara: '10 maggi aala'"
      );
    } else {
      store.stock[key] = (store.stock[key] || 0) + result.quantity;
      replyText = reply(lang,
        `✅ ${result.quantity} ${result.product} add ho gaya\n📦 Total ${result.product}: ${store.stock[key]}`,
        `✅ Added ${result.quantity} ${result.product}\n📦 Total ${result.product}: ${store.stock[key]}`,
        `✅ ${result.quantity} ${result.product} add zala\n📦 Total ${result.product}: ${store.stock[key]}`
      );
    }
  }

  else if (result.intent === "stock_sell") {
    const key = result.product?.toLowerCase();
    if (!key || !result.quantity) {
      replyText = reply(lang,
        "❓ Try karo: 'becha 3 maggi'",
        "❓ Try: 'sold 3 maggi'",
        "❓ Try kara: '3 maggi vikla'"
      );
    } else {
      const current = store.stock[key] || 0;
      if (current < result.quantity) {
        replyText = reply(lang,
          `⚠️ Sirf ${current} ${result.product} stock mein hai!`,
          `⚠️ Only ${current} ${result.product} left in stock!`,
          `⚠️ Fakt ${current} ${result.product} stock madhe ahe!`
        );
      } else {
        store.stock[key] -= result.quantity;
        store.sales.push({ product: key, quantity: result.quantity, time: new Date() });
        replyText = reply(lang,
          `🛒 ${result.quantity} ${result.product} becha\n📦 Bacha: ${store.stock[key]}`,
          `🛒 Sold ${result.quantity} ${result.product}\n📦 Remaining: ${store.stock[key]}`,
          `🛒 ${result.quantity} ${result.product} vikla\n📦 Urilele: ${store.stock[key]}`
        );
      }
    }
  }

  else if (result.intent === "udhaar") {
    const key = result.person?.toLowerCase();
    if (!key || !result.amount) {
      replyText = reply(lang,
        "❓ Try karo: 'Ramesh ko 500 udhaar diya'",
        "❓ Try: 'udhaar 500 from Ramesh'",
        "❓ Try kara: 'Ramesh la 500 udhar dila'"
      );
    } else {
      store.udhaar[key] = (store.udhaar[key] || 0) + result.amount;
      replyText = reply(lang,
        `💰 ${result.person} pe ₹${store.udhaar[key]} udhaar hai`,
        `💰 ${result.person} owes ₹${store.udhaar[key]}`,
        `💰 ${result.person} kade ₹${store.udhaar[key]} udhar ahe`
      );
    }
  }

  else if (result.intent === "udhaar_paid") {
    const key = result.person?.toLowerCase();
    if (!key || !result.amount) {
      replyText = reply(lang,
        "❓ Try karo: 'Ramesh ne 200 diya'",
        "❓ Try: 'Ramesh paid 200'",
        "❓ Try kara: 'Ramesh ne 200 dile'"
      );
    } else {
      const owed = store.udhaar[key] || 0;
      store.udhaar[key] = Math.max(0, owed - result.amount);
      if (store.udhaar[key] === 0) {
        replyText = reply(lang,
          `✅ ${result.person} ne saara udhaar chuka diya! 🎉`,
          `✅ ${result.person} has cleared all dues! 🎉`,
          `✅ ${result.person} ne saara udhar feda kela! 🎉`
        );
      } else {
        replyText = reply(lang,
          `✅ ${result.person} ne ₹${result.amount} diya. Ab ₹${store.udhaar[key]} baaki`,
          `✅ ${result.person} paid ₹${result.amount}. Still owes ₹${store.udhaar[key]}`,
          `✅ ${result.person} ne ₹${result.amount} dile. ₹${store.udhaar[key]} baaki ahe`
        );
      }
    }
  }

  else if (result.intent === "balance") {
    const items = Object.entries(store.stock);
    if (items.length === 0) {
      replyText = reply(lang,
        "📦 Stock abhi khali hai.",
        "📦 Stock is empty.",
        "📦 Stock rikt ahe."
      );
    } else {
      const list = items.map(([p, q]) => `• ${p}: ${q}`).join("\n");
      replyText = reply(lang,
        `📦 *Stock Balance*\n${list}`,
        `📦 *Stock Balance*\n${list}`,
        `📦 *Stock Balance*\n${list}`
      );
    }
  }

  else if (result.intent === "report") {
    const stockList = Object.entries(store.stock).map(([p, q]) => `• ${p}: ${q}`).join("\n") || "  (kuch nahi)";
    const udhaarList = Object.entries(store.udhaar).filter(([, v]) => v > 0).map(([p, v]) => `• ${p}: ₹${v}`).join("\n") || "  (koi nahi)";
    const totalSold = store.sales.reduce((s, x) => s + x.quantity, 0);
    replyText = reply(lang,
      `📊 *Aaj ka Report*\n\n📦 Stock:\n${stockList}\n\n💰 Udhaar:\n${udhaarList}\n\n🛒 Aaj becha: ${totalSold} items`,
      `📊 *Today's Report*\n\n📦 Stock:\n${stockList}\n\n💰 Udhaar:\n${udhaarList}\n\n🛒 Sold today: ${totalSold} items`,
      `📊 *Aajcha Report*\n\n📦 Stock:\n${stockList}\n\n💰 Udhar:\n${udhaarList}\n\n🛒 Aaj vikle: ${totalSold} items`
    );
  }

  else {
    replyText = reply(lang,
      "❓ Samajh nahi aaya! Try karo:\n• '10 maggi aaya'\n• 'becha 3 chips'\n• 'Ramesh ko 500 udhaar'\n• 'balance'\n• 'report'",
      "❓ Didn't understand! Try:\n• 'add 10 maggi'\n• 'sold 3 chips'\n• 'udhaar 500 from Ramesh'\n• 'balance'\n• 'report'",
      "❓ Samajhla nahi! Try kara:\n• '10 maggi aala'\n• '3 chips vikla'\n• 'Ramesh la 500 udhar'\n• 'balance'\n• 'report'"
    );
  }

  res.set("Content-Type", "text/xml");
  res.send(`<Response><Message>${replyText}</Message></Response>`);
});

app.listen(3000, () => console.log("🚀 Server listening on http://localhost:3000"));