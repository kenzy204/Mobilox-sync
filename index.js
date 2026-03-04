// index.js
// require("dotenv").config({ override: true });
// let TEST_LIMIT = 10;
// let processedCount = 0;
require("dotenv").config({ override: true });

const TEST_LIMIT = process.env.TEST_LIMIT ? Number(process.env.TEST_LIMIT) : 0; // 0 = unlimited
let processedCount = 0;

const express = require("express");
const fs = require("fs");
const path = require("path");
const { parseStringPromise } = require("xml2js");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");

// ✅ Your modules:
const { parseMobiloxVehicleXml } = require("./mobilox_mapper");      // <-- rename if needed
const { upsertBike } = require("./mobilox_to_shopify");              // <-- rename if needed

const app = express();

// Mobilox sends XML text
app.use(cookieParser());
app.use(express.text({ type: ["application/xml", "text/xml", "*/*"], limit: "15mb" }));

/**
 * =========================
 * Simple in-memory queue
 * =========================
 * Mobilox may POST hundreds quickly.
 * We ACK ("1") fast to Mobilox, and process in background safely.
 */
const CONCURRENCY = Number(process.env.SYNC_CONCURRENCY || 2); // 2 is safe, can increase later
const queue = [];
let active = 0;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runQueue() {
  if (active >= CONCURRENCY) return;
  const job = queue.shift();
  if (!job) return;

  active++;
  try {
    await job();
  } catch (e) {
    console.error("❌ Queue job failed:", e?.message || e);
  } finally {
    active--;
    // keep going
    setImmediate(runQueue);
  }
}

function enqueue(jobFn) {
  queue.push(jobFn);
  setImmediate(runQueue);
}

// ---------- Helpers ----------
function timingSafeEqual(a, b) {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function verifyShopifyHmac(query, clientSecret) {
  const { hmac, signature, ...rest } = query; // ignore signature (legacy)
  if (!hmac) return false;

  const message = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${Array.isArray(rest[key]) ? rest[key].join(",") : rest[key]}`)
    .join("&");

  const digest = crypto.createHmac("sha256", clientSecret).update(message).digest("hex");
  return timingSafeEqual(digest, hmac);
}

function isValidShopDomain(shop) {
  return /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/.test(shop);
}

// ---------- Basic routes ----------
app.get("/", (req, res) => {
  res.send(
    `Mobilox Sync running ✅\n` +
    `Queue length: ${queue.length}\n` +
    `Active workers: ${active}/${CONCURRENCY}\n`
  );
});

app.get("/health", (req, res) => res.status(200).send("healthy"));

// ---------- Mobilox webhook ----------
// app.post("/mobilox/incremental", async (req, res) => {
//   try {
//     const xml = req.body || "";
//     if (!xml.trim()) return res.status(400).send("0");

//     // ✅ IMPORTANT: Mobilox requires body exactly "1" to mark success.
//     // We'll ACK immediately to stop retries.
//     res.status(200).send("1");

//     // Save payload for debugging (optional)
//     try {
//       fs.writeFileSync(path.join(__dirname, "mobilox_sample.xml"), xml, "utf8");
//     } catch {}

//     // Add work to queue (safe for 500+)
//     enqueue(async () => {
//       // Parse into bike object
//       const bike = await parseMobiloxVehicleXml(xml);

//       if (!bike?.mobiloxId) {
//         console.log("⚠️ Skipping: missing mobiloxId");
//         return;
//       }

//       console.log(`🚲 Sync start: ${bike.mobiloxId} | ${bike.title}`);

//       // Call Shopify upsert
//       await upsertBike(bike);

//       console.log(`✅ Sync done: ${bike.mobiloxId}`);

//       // tiny pause helps with Shopify throttling during huge batches
//       await sleep(Number(process.env.SYNC_DELAY_MS || 150));
//     });
//   } catch (err) {
//     // If we reached here, response might already be sent.
//     console.error("❌ Mobilox handler error:", err?.message || err);
//     try {
//       if (!res.headersSent) res.status(500).send("0");
//     } catch {}
//   }
// });
// app.post("/mobilox/incremental", async (req, res) => {
//     try {
//       // always answer "1" to Mobilox quickly (it expects exactly '1')
//       res.status(200).send("1");
  
//       if (processedCount >= TEST_LIMIT) {
//         console.log("🛑 TEST LIMIT REACHED — skipping");
//         return;
//       }
  
//       const xml = req.body || "";
//       if (!xml.trim()) {
//         console.log("⚠️ Empty XML received");
//         return;
//       }
  
//       processedCount++;
//       console.log(`🚲 TEST SYNC ${processedCount}/${TEST_LIMIT}`);
  
//       // Save last payload for debugging
//       fs.writeFileSync("mobilox_sample.xml", xml, "utf8");
  
//       // 1) XML -> bike object
//       const bike = await parseMobiloxVehicleXml(xml);
//       console.log("🧩 Parsed bike:", bike.mobiloxId, bike.title);
  
//       // 2) bike -> Shopify upsert
//       const productId = await upsertBike(bike);
//       console.log("✅ Synced to Shopify product:", productId);
  
//     } catch (err) {
//       console.error("❌ Mobilox sync error:", err);
//       // DO NOT change the response here because we already sent "1"
//     }
//   });
  app.post("/mobilox/incremental", async (req, res) => {
  try {
    res.status(200).send("1");

    if (TEST_LIMIT > 0 && processedCount >= TEST_LIMIT) {
      console.log("🛑 TEST LIMIT REACHED — skipping");
      return;
    }

    const xml = req.body || "";
    if (!xml.trim()) {
      console.log("⚠️ Empty XML received");
      return;
    }

    processedCount++;
    console.log(`🚲 SYNC ${processedCount}${TEST_LIMIT > 0 ? `/${TEST_LIMIT}` : ""}`);

    fs.writeFileSync("mobilox_sample.xml", xml, "utf8");

    const bike = await parseMobiloxVehicleXml(xml);
    console.log("🧩 Parsed bike:", bike.mobiloxId, bike.title);

    const productId = await upsertBike(bike);
    console.log("✅ Synced to Shopify product:", productId);

  } catch (err) {
    console.error("❌ Mobilox sync error:", err);
  }
});
// ---------- (Optional) quick debug route to see XML structure ----------
app.get("/debug/last", async (req, res) => {
  try {
    const xml = fs.readFileSync(path.join(__dirname, "mobilox_sample.xml"), "utf8");
    const parsed = await parseStringPromise(xml, { explicitArray: false, mergeAttrs: true });
    res.json({ topLevelKeys: Object.keys(parsed), parsedSample: parsed.voertuig ? "has voertuig" : "no voertuig" });
  } catch (e) {
    res.status(404).json({ error: "No mobilox_sample.xml saved yet" });
  }
});

// ---------- Shopify OAuth ----------
app.get("/shopify/install", (req, res) => {
  const shop = req.query.shop;
  if (!shop || !isValidShopDomain(shop)) {
    return res.status(400).send("Missing or invalid ?shop=xxxx.myshopify.com");
  }

  const state = crypto.randomBytes(16).toString("hex");
  res.cookie("shopify_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: true });

  const scopes = [
    "read_products", "write_products",
    "read_inventory", "write_inventory",
    "read_locations",
    "read_metafields", "write_metafields",
    "write_files"
  ].join(",");

  const redirectUri = `${process.env.APP_URL}/shopify/callback`;

  const authUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${process.env.SHOPIFY_CLIENT_ID}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}`;

  return res.redirect(authUrl);
});

app.get("/shopify/callback", async (req, res) => {
  const { shop, code, state } = req.query;

  if (!shop || !isValidShopDomain(shop)) return res.status(400).send("Invalid shop");
  if (!code) return res.status(400).send("Missing code");
  if (!state) return res.status(400).send("Missing state");

  const cookieState = req.cookies.shopify_oauth_state;
  if (!cookieState || cookieState !== state) return res.status(400).send("Invalid state");

  const okHmac = verifyShopifyHmac(req.query, process.env.SHOPIFY_CLIENT_SECRET);
  if (!okHmac) return res.status(400).send("Invalid HMAC");

  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      code,
    }),
  });

  const tokenJson = await tokenRes.json();

  if (!tokenRes.ok) {
    console.error("Token exchange failed:", tokenJson);
    return res.status(500).send("Token exchange failed (check logs)");
  }

  fs.writeFileSync(
    path.join(__dirname, "shopify_token.json"),
    JSON.stringify(
      { shop, access_token: tokenJson.access_token, scope: tokenJson.scope, obtained_at: new Date().toISOString() },
      null,
      2
    ),
    "utf8"
  );

  console.log("✅ OAuth complete for shop:", shop);
  console.log("✅ Token saved to shopify_token.json");

  return res.status(200).send("OAuth complete. Token saved.");
});

// ---------- Start ----------
const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Listening on http://localhost:${port}`));
