// require("dotenv").config();

// const SHOP = process.env.SHOPIFY_SHOP;
// const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
// const VERSION = process.env.SHOPIFY_API_VERSION;

// async function shopifyGraphQL(query, variables = {}) {
//   const res = await fetch(
//     `https://${SHOP}/admin/api/${VERSION}/graphql.json`,
//     {
//       method: "POST",
//       headers: {
//         "X-Shopify-Access-Token": TOKEN,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({ query, variables }),
//     }
//   );

//   const json = await res.json();

//   if (!res.ok || json.errors) {
//     console.error(json);
//     throw new Error("Shopify API error");
//   }

//   return json.data;
// }

// module.exports = { shopifyGraphQL };
// require("dotenv").config();

// const SHOP = process.env.SHOPIFY_SHOP;
// const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
// const VERSION = process.env.SHOPIFY_API_VERSION;

// function sleep(ms) {
//   return new Promise((r) => setTimeout(r, ms));
// }

// async function shopifyGraphQL(query, variables = {}, attempt = 1) {
//   try {
//     const res = await fetch(`https://${SHOP}/admin/api/${VERSION}/graphql.json`, {
//       method: "POST",
//       headers: {
//         "X-Shopify-Access-Token": TOKEN,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({ query, variables }),
//     });

//     const json = await res.json();

//     if (!res.ok || json.errors) {
//       console.error("Shopify GraphQL error:", JSON.stringify(json, null, 2));
//       throw new Error("Shopify API error");
//     }

//     return json.data;
//   } catch (err) {
//     // retry network timeouts / fetch failed
//     const msg = String(err?.message || err);
//     if (attempt <= 3 && (msg.includes("fetch failed") || msg.includes("ETIMEDOUT"))) {
//       console.log(`⏳ Shopify request failed, retrying (${attempt}/3)...`);
//       await sleep(800 * attempt);
//       return shopifyGraphQL(query, variables, attempt + 1);
//     }
//     throw err;
//   }
// }

// module.exports = { shopifyGraphQL };
// shopify.js
require("dotenv").config();

const SHOP = process.env.SHOPIFY_SHOP;
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const VERSION = process.env.SHOPIFY_API_VERSION || "2024-01";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function shopifyGraphQL(query, variables = {}, attempt = 1) {
  try {
    const res = await fetch(`https://${SHOP}/admin/api/${VERSION}/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });

    const json = await res.json();

    // ✅ 1) Handle Shopify GraphQL "Throttled" error (rate limit)
    const throttled = Array.isArray(json?.errors)
      && json.errors.some((e) => e?.extensions?.code === "THROTTLED" || e?.message === "Throttled");

    if (throttled) {
      const throttle = json?.extensions?.cost?.throttleStatus;
      const currentlyAvailable = Number(throttle?.currentlyAvailable ?? 0);
      const restoreRate = Number(throttle?.restoreRate ?? 100);

      // wait until some budget is restored (simple + safe)
      // if currentlyAvailable is very low, wait longer
      const need = 50; // how many cost points we want before retrying
      const deficit = Math.max(0, need - currentlyAvailable);
      const waitMs = Math.ceil((deficit / restoreRate) * 1000) + 500;

      console.log(
        `⏳ Shopify throttled — available=${currentlyAvailable}, restoreRate=${restoreRate}/s — waiting ${waitMs}ms then retry...`
      );

      await sleep(waitMs);
      return shopifyGraphQL(query, variables, attempt); // retry same attempt number
    }

    // ✅ 2) If HTTP not ok or other GraphQL errors → throw
    if (!res.ok || json.errors) {
      console.error("Shopify GraphQL error:", JSON.stringify(json, null, 2));
      throw new Error("Shopify API error");
    }

    return json.data;
  } catch (err) {
    // ✅ 3) Retry network/timeouts
    const msg = String(err?.message || err);

    // Add a couple more transient cases
    const transient =
      msg.includes("fetch failed") ||
      msg.includes("ETIMEDOUT") ||
      msg.includes("ECONNRESET") ||
      msg.includes("ENOTFOUND") ||
      msg.includes("EAI_AGAIN");

    if (attempt <= 5 && transient) {
      const wait = 800 * attempt;
      console.log(`⏳ Shopify request failed (${msg}), retrying (${attempt}/5) in ${wait}ms...`);
      await sleep(wait);
      return shopifyGraphQL(query, variables, attempt + 1);
    }

    throw err;
  }
}

module.exports = { shopifyGraphQL };