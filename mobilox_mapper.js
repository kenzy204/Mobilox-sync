// const { parseStringPromise } = require("xml2js");

// function asArray(x) {
//   if (!x) return [];
//   return Array.isArray(x) ? x : [x];
// }

// function decodeHtml(str) {
//   if (!str) return "";
//   return String(str)
//     .replace(/&lt;/g, "<")
//     .replace(/&gt;/g, ">")
//     .replace(/&amp;/g, "&")
//     .replace(/&quot;/g, '"')
//     .replace(/&#39;/g, "'");
// }

// function extractUnsupportedMap(v) {
//   const props = asArray(v.unsupportedProperties?.unsupportedProperty);
//   const map = {};
//   for (const p of props) {
//     const key = (p?.key || "").trim();
//     const value = (p?.value || "").trim();
//     if (!key) continue;
//     // keep first value; if duplicates exist, don't overwrite
//     if (!map[key]) map[key] = value;
//   }
//   return map;
// }

// function extractBatteryWh(text) {
//   // finds "500 WH" or "500Wh" etc
//   if (!text) return null;
//   const m = String(text).match(/(\d{3,4})\s*W\s*H/i);
//   if (!m) return null;
//   return `${m[1]}Wh`;
// }

// async function parseMobiloxVehicleXml(xml) {
//   const data = await parseStringPromise(xml, { explicitArray: false, trim: true });

//   // Root is <voertuig ...>
//   const v = data.voertuig || data;

//   const mobiloxId = v.voertuignr ? String(v.voertuignr).trim() : null;

//   // price
//   let price = "0.00";
//   const prijsNode = v.verkoopprijs_particulier?.prijs;
//   const p = Array.isArray(prijsNode) ? prijsNode[0] : prijsNode;
//   if (p?.bedrag) {
//     const num = Number(String(p.bedrag).replace(",", "."));
//     price = isNaN(num) ? "0.00" : num.toFixed(2);
//   }

//   // condition
//   const isNew = String(v.nieuw_voertuig || "").toLowerCase() === "j";
//   const condition = isNew ? "new" : "used";

//   // sold/reserved → out of stock
//   const sold = String(v.verkocht || "").toLowerCase() === "j";
//   const reserved = String(v.gereserveerd || "").toLowerCase() === "j";
//  // model_orig (you want to push to custom.model_opties)
//  const modelOrig = v.model_orig ? String(v.model_orig).trim() : "";
//   // title
//   const titel = (v.titel || "").trim();
//   const merk = (v.merk || "").trim();
//   const carrosserie = (v.carrosserie || "").trim();

//   const title =
//     titel ||
//     [merk && merk !== "Onbekend" ? merk : null, carrosserie || null, mobiloxId ? `#${mobiloxId}` : null]
//       .filter(Boolean)
//       .join(" ");

//   // description (Mobilox puts HTML-escaped content in <opmerkingen>)
//   const descriptionHtml = decodeHtml(v.opmerkingen || "");

//   // color
//   const color =
//     (v.kleur && String(v.kleur).trim()) ||
//     (v.basiskleur && String(v.basiskleur).trim()) ||
//     null;

//   // frame size (from <framehoogte>)
//   const frameSize = v.framehoogte ? String(v.framehoogte).trim() : "";

//   // images
//   const afbeeldingen = asArray(v.afbeeldingen?.afbeelding);
//   const imageUrls = afbeeldingen
//     .map((a) => (a?.url ? String(a.url).trim() : null))
//     .filter(Boolean);

//   // availability metafield
//   let availability = "in_stock";
//   if (sold) availability = "sold";
//   else if (reserved) availability = "reserved";

//   // unsupportedProperties (often contains bike specs)
//   const unsupported = extractUnsupportedMap(v);

//   // motor: from unsupported "Type motor" OR try from accessories text
//   let motor = unsupported["Type motor"] || "";

//   // accessories text fallback (Bosch, Shimano, etc)
//   if (!motor) {
//     const acc = asArray(v.accessoires?.accessoire)
//       .map((a) => (a?.naam ? String(a.naam) : ""))
//       .join(" | ");
//     const m = acc.match(/(Bosch|Shimano|Yamaha|Bafang)[^|]{0,60}(motor|middenmotor)/i);
//     motor = m ? m[0].trim() : "";
//   }

//   // battery: detect Wh in accessories or remarks
//   const accText = asArray(v.accessoires?.accessoire)
//     .map((a) => (a?.naam ? String(a.naam) : ""))
//     .join(" ");
//   const battery = extractBatteryWh(accText) || extractBatteryWh(descriptionHtml) || "";

//   return {
//     mobiloxId,
//     title,
//     descriptionHtml,
//     price,
//     brand: merk && merk !== "Onbekend" ? merk : "Mobilox",
//     frameSize,
//     color,
//     motor,
//     battery,
//     condition,
//     availability,
//     inStock: !(sold || reserved),
//     imageUrls,
//     modelOrig,
    
//   };
// }

// module.exports = { parseMobiloxVehicleXml };
const { parseStringPromise } = require("xml2js");

function asArray(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

function decodeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractUnsupportedMap(v) {
  const props = asArray(v.unsupportedProperties?.unsupportedProperty);
  const map = {};
  for (const p of props) {
    const key = (p?.key || "").trim();
    const value = (p?.value || "").trim();
    if (!key) continue;
    if (!map[key]) map[key] = value;
  }
  return map;
}

function extractBatteryWh(text) {
  if (!text) return null;
  const m = String(text).match(/(\d{3,4})\s*W\s*H/i);
  if (!m) return null;
  return `${m[1]}Wh`;
}

async function parseMobiloxVehicleXml(xml) {
  const data = await parseStringPromise(xml, { explicitArray: false, trim: true });

  // Root is <voertuig ...>
  const v = data.voertuig || data;

  const mobiloxId = v.voertuignr ? String(v.voertuignr).trim() : null;

  // price
  //let price = "0.00";
   //const prijsNode = v.verkoopprijs_particulier?.prijs;
  //const prijsNode = v.verkoopprijs_particulier?.prijzen?.prijs;
  //const prijsNode =
  //v.verkoopprijs_particulier?.prijzen?.prijs ??
  //v.verkoopprijs_particulier?.prijs;

  //const p = Array.isArray(prijsNode) ? prijsNode[0] : prijsNode;
  //if (p?.bedrag) {
   // const num = Number(String(p.bedrag).replace(",", "."));
   // price = isNaN(num) ? "0.00" : num.toFixed(2);
  //}
let price = "0.00";

const prijsNode = v.verkoopprijs_particulier?.prijzen?.prijs;
const p = Array.isArray(prijsNode) ? prijsNode[0] : prijsNode;

const rawBedrag =
  p?.bedrag?._ ??   // when xml2js wraps value
  p?.bedrag ??      // normal case
  null;

if (rawBedrag) {
  const num = Number(String(rawBedrag).replace(",", "."));
  price = Number.isNaN(num) ? "0.00" : num.toFixed(2);
}
  // condition
  const isNew = String(v.nieuw_voertuig || "").toLowerCase() === "j";
  const condition = isNew ? "new" : "used";

  // ✅ stock flags
  const sold = String(v.verkocht || "").toLowerCase() === "j";
  const reserved = String(v.gereserveerd || "").toLowerCase() === "j";

  // optional: expected / coming soon
  const expectedRaw = (v.verwacht ?? "").toString().trim();
  const expected = expectedRaw.length > 0;

  // ✅ availability + inStock (consistent)
  let availability = "in_stock";
  let inStock = true;

  if (sold) {
    availability = "sold";
    inStock = false;
  } else if (reserved) {
    availability = "reserved";
    inStock = false;
  } else if (expected) {
    availability = "expected";
    inStock = false; // if you want expected to be NOT sellable
  }

  // model_orig (you want to push to custom.model_opties)
  const modelOrig = v.model_orig ? String(v.model_orig).trim() : "";

  // title
  const titel = (v.titel || "").trim();
  const merk = (v.merk || "").trim();
  const carrosserie = (v.carrosserie || "").trim();

  const title =
    titel ||
    [merk && merk !== "Onbekend" ? merk : null, carrosserie || null, mobiloxId ? `#${mobiloxId}` : null]
      .filter(Boolean)
      .join(" ");

  // descriptionHtml
  const descriptionHtml = decodeHtml(v.opmerkingen || "");

  // color
  const color =
    (v.kleur && String(v.kleur).trim()) ||
    (v.basiskleur && String(v.basiskleur).trim()) ||
    null;

  // frame size
  const frameSize = v.framehoogte ? String(v.framehoogte).trim() : "";

  // images
  const afbeeldingen = asArray(v.afbeeldingen?.afbeelding);
  const imageUrls = afbeeldingen
    .map((a) => (a?.url ? String(a.url).trim() : null))
    .filter(Boolean);

  // unsupportedProperties
  const unsupported = extractUnsupportedMap(v);

  // motor
  let motor = unsupported["Type motor"] || "";
  if (!motor) {
    const acc = asArray(v.accessoires?.accessoire)
      .map((a) => (a?.naam ? String(a.naam) : ""))
      .join(" | ");
    const m = acc.match(/(Bosch|Shimano|Yamaha|Bafang)[^|]{0,60}(motor|middenmotor)/i);
    motor = m ? m[0].trim() : "";
  }

  // battery
  const accText = asArray(v.accessoires?.accessoire)
    .map((a) => (a?.naam ? String(a.naam) : ""))
    .join(" ");
  const battery = extractBatteryWh(accText) || extractBatteryWh(descriptionHtml) || "";

  return {
    mobiloxId,
    title,
    descriptionHtml,
    price,
    brand: merk && merk !== "Onbekend" ? merk : "Mobilox",
    frameSize,
    color,
    motor,
    battery,
    condition,
    availability,
    inStock,
    imageUrls,
    modelOrig,
  };
}

module.exports = { parseMobiloxVehicleXml };
