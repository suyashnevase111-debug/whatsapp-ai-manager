require("dotenv").config();

function analyzeMessage(message) {
  const msg = message.toLowerCase().trim();

  // Stock Add patterns
  if (msg.match(/^add\s+(\d+)\s+(.+)/) || msg.match(/(\d+)\s+(.+)\s+aaya/)) {
    const match = msg.match(/^add\s+(\d+)\s+(.+)/) || msg.match(/(\d+)\s+(.+)\s+aaya/);
    return { intent: "stock_add", quantity: parseInt(match[1]), product: match[2].replace("aaya","").trim(), person: null, amount: null };
  }

  // Stock Sell patterns
  if (msg.match(/^sold\s+(\d+)\s+(.+)/) || msg.match(/^becha\s+(\d+)\s+(.+)/)) {
    const match = msg.match(/^sold\s+(\d+)\s+(.+)/) || msg.match(/^becha\s+(\d+)\s+(.+)/);
    return { intent: "stock_sell", quantity: parseInt(match[1]), product: match[2].trim(), person: null, amount: null };
  }

  // Udhaar patterns
  if (msg.match(/udhaar\s+(\d+)\s+from\s+(\w+)/) || msg.match(/(\w+)\s+ko\s+(\d+)\s+(udhar|udhaar)/)) {
    const match = msg.match(/udhaar\s+(\d+)\s+from\s+(\w+)/) || msg.match(/(\w+)\s+ko\s+(\d+)\s+(udhar|udhaar)/);
    if (msg.includes("from")) {
      return { intent: "udhaar", amount: parseInt(match[1]), person: match[2], product: null, quantity: null };
    } else {
      return { intent: "udhaar", amount: parseInt(match[2]), person: match[1], product: null, quantity: null };
    }
  }

  // Balance
  if (msg.includes("balance") || msg.includes("stock check") || msg.includes("kitna stock")) {
    return { intent: "balance", product: null, quantity: null, person: null, amount: null };
  }

  // Report
  if (msg.includes("report") || msg.includes("summary")) {
    return { intent: "report", product: null, quantity: null, person: null, amount: null };
  }

  return { intent: "unknown", product: null, quantity: null, person: null, amount: null };
}

module.exports = { analyzeMessage };