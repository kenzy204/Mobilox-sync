
// // mobilox_to_shopify.js
// require("dotenv").config({ override: true });
// const { shopifyGraphQL } = require("./shopify");

// const NS = "custom";
// const LOCATION_ID = process.env.SHOPIFY_LOCATION_ID;

// // Change to "ACTIVE" only when you are ready to go live
// const DEFAULT_STATUS = process.env.PRODUCT_STATUS || "DRAFT";

// function asArray(x) {
//   if (!x) return [];
//   return Array.isArray(x) ? x : [x];
// }

// function normalizeUrl(u) {
//   if (!u) return "";
//   return String(u).trim().replace(/\s+/g, ""); // remove any accidental whitespace/newlines
// }

// async function findProductByMobiloxId(mobiloxId) {
//   const query = `
//     query($q: String!) {
//       products(first: 1, query: $q) {
//         nodes {
//           id
//           title
//           variants(first: 1) {
//             nodes { id inventoryItem { id } }
//           }
//         }
//       }
//     }
//   `;

//   const q = `metafield:${NS}.mobilox_id:${mobiloxId}`;
//   const data = await shopifyGraphQL(query, { q });
//   return data.products?.nodes?.[0] || null;
// }

// async function createProductSkeleton(bike) {
//   const mutation = `
//     mutation($input: ProductInput!) {
//       productCreate(input: $input) {
//         product {
//           id
//           title
//           variants(first: 1) { nodes { id inventoryItem { id } } }
//         }
//         userErrors { field message }
//       }
//     }
//   `;

//   const variables = {
//     input: {
//       title: bike.title,
//       vendor: bike.brand || "Mobilox",
//       productType: "Bike",
//       status: DEFAULT_STATUS,
//       tags: ["mobilox-sync"],
//     },
//   };

//   const res = await shopifyGraphQL(mutation, variables);
//   const errs = res.productCreate?.userErrors || [];
//   if (errs.length) throw new Error("productCreate: " + JSON.stringify(errs));
//   return res.productCreate.product;
// }

// async function updateCoreFields(productId, bike) {
//   const mutation = `
//     mutation($input: ProductInput!) {
//       productUpdate(input: $input) {
//         product { id title }
//         userErrors { field message }
//       }
//     }
//   `;

//   const variables = {
//     input: {
//       id: productId,
//       title: bike.title,
//       descriptionHtml: bike.descriptionHtml || "",
//       vendor: bike.brand || "Mobilox",
//       productType: "Bike",
//       status: DEFAULT_STATUS,
//       tags: ["mobilox-sync"],
//     },
//   };

//   const res = await shopifyGraphQL(mutation, variables);
//   const errs = res.productUpdate?.userErrors || [];
//   if (errs.length) throw new Error("productUpdate: " + JSON.stringify(errs));
// }

// async function setMetafields(productId, bike) {
//   const mutation = `
//     mutation($metafields: [MetafieldsSetInput!]!) {
//       metafieldsSet(metafields: $metafields) {
//         metafields { id namespace key value }
//         userErrors { field message }
//       }
//     }
//   `;

//   function add(list, key, value, type = "single_line_text_field") {
//     const v = value == null ? "" : String(value).trim();
//     if (!v) return;
//     list.push({ ownerId: productId, namespace: NS, key, value: v, type });
//   }

//   const metafields = [];

//   // Required
//   add(metafields, "mobilox_id", bike.mobiloxId);

//   // Optional
//   add(metafields, "condition", bike.condition);
//   add(metafields, "frame_size", bike.frameSize);
//   add(metafields, "kleur_opties", bike.color);
//   add(metafields, "Motor", bike.motor); // keep as-is if you already rely on it
//   add(metafields, "battery", bike.battery);
//   add(metafields, "availability", bike.availability);

//   const res = await shopifyGraphQL(mutation, { metafields });
//   const errs = res.metafieldsSet?.userErrors || [];
//   if (errs.length) throw new Error("metafieldsSet: " + JSON.stringify(errs));
// }

// async function updateVariant(productId, variantId, bike) {
//   const mutation = `
//     mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
//       productVariantsBulkUpdate(productId: $productId, variants: $variants) {
//         product { id }
//         productVariants { id price }
//         userErrors { field message }
//       }
//     }
//   `;

//   const variables = {
//     productId,
//     variants: [
//       {
//         id: variantId,
//         price: String(bike.price || "0.00"),
//       },
//     ],
//   };

//   const res = await shopifyGraphQL(mutation, variables);
//   const errs = res.productVariantsBulkUpdate?.userErrors || [];
//   if (errs.length) throw new Error("productVariantsBulkUpdate: " + JSON.stringify(errs));
// }

// async function enableInventoryTracking(inventoryItemId) {
//   const mutation = `
//     mutation inventoryItemUpdate($id: ID!, $input: InventoryItemInput!) {
//       inventoryItemUpdate(id: $id, input: $input) {
//         inventoryItem { id tracked }
//         userErrors { field message }
//       }
//     }
//   `;

//   const variables = {
//     id: inventoryItemId,
//     input: { tracked: true },
//   };

//   const res = await shopifyGraphQL(mutation, variables);
//   const errs = res.inventoryItemUpdate?.userErrors || [];
//   if (errs.length) throw new Error("inventoryItemUpdate: " + JSON.stringify(errs));
// }

// async function setInventory(inventoryItemId, qty, mobiloxId) {
//   if (!LOCATION_ID) throw new Error("Missing SHOPIFY_LOCATION_ID in .env");

//   const mutation = `
//     mutation inventorySetOnHandQuantities($input: InventorySetOnHandQuantitiesInput!) {
//       inventorySetOnHandQuantities(input: $input) {
//         userErrors { field message }
//       }
//     }
//   `;

//   const variables = {
//     input: {
//       reason: "correction", // ✅ REQUIRED (must be one of Shopify's allowed reasons)
//       // optional but recommended for audit trail:
//       referenceDocumentUri: mobiloxId
//         ? `gid://mobilox-connector/Vehicle/${mobiloxId}`
//         : `gid://mobilox-connector/SyncJob/${Date.now()}`,
//       setQuantities: [
//         {
//           inventoryItemId,
//           locationId: LOCATION_ID,
//           quantity: qty,
//           changeFromQuantity: null, // optional but matches Shopify example
//         },
//       ],
//     },
//   };

//   const res = await shopifyGraphQL(mutation, variables);
//   const errs = res.inventorySetOnHandQuantities?.userErrors || [];
//   if (errs.length) throw new Error("inventorySetOnHandQuantities: " + JSON.stringify(errs));
// }

// /**
//  * ✅ Correct image sync
//  * - Shopify returns CDN URLs, so you cannot compare them to Mobilox URLs.
//  * - Solution: store Mobilox URL in image alt text; dedupe via altText.
//  * - Upload in small batches; don’t fail entire sync if one image fails.
//  */
// async function syncImages(productId, imageUrls) {
//   const urls = asArray(imageUrls)
//     .map(normalizeUrl)
//     .filter((u) => u && /^https?:\/\//i.test(u));

//   if (urls.length === 0) return;

//   // Fetch existing media altText values (we store original Mobilox URL there)
//   const q = `
//     query($id: ID!) {
//       product(id: $id) {
//         media(first: 100) {
//           nodes {
//             ... on MediaImage {
//               id
//               image { altText url }
//             }
//           }
//         }
//       }
//     }
//   `;

//   const existing = await shopifyGraphQL(q, { id: productId });

//   const existingAlts = new Set(
//     (existing.product?.media?.nodes || [])
//       .map((m) => m?.image?.altText)
//       .filter(Boolean)
//   );

//   const toAdd = urls.filter((u) => !existingAlts.has(u));
//   if (toAdd.length === 0) return;

//   const mutation = `
//     mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
//       productCreateMedia(productId: $productId, media: $media) {
//         media { ... on MediaImage { id } }
//         mediaUserErrors { field message }
//       }
//     }
//   `;

//   const BATCH_SIZE = Number(process.env.IMAGE_BATCH_SIZE || 5);

//   for (let i = 0; i < toAdd.length; i += BATCH_SIZE) {
//     const batch = toAdd.slice(i, i + BATCH_SIZE);

//     const variables = {
//       productId,
//       media: batch.map((u) => ({
//         mediaContentType: "IMAGE",
//         originalSource: u,
//         alt: u, // ✅ store Mobilox URL for stable dedupe
//       })),
//     };

//     const res = await shopifyGraphQL(mutation, variables);
//     const errs = res.productCreateMedia?.mediaUserErrors || [];

//     // Don’t kill the whole product sync; log and continue
//     if (errs.length) {
//       console.warn("⚠️ productCreateMedia errors:", { productId, errs, batch });
//     }
//   }
// }

// async function upsertBike(bike) {
//   if (!bike?.mobiloxId) throw new Error("upsertBike: missing bike.mobiloxId");

//   // 1) Find existing by mobilox metafield
//   let product = await findProductByMobiloxId(bike.mobiloxId);

//   // 2) Create if missing
//   if (!product) {
//     product = await createProductSkeleton(bike);
//     console.log("🆕 Created product", product.id);
//   } else {
//     console.log("🔁 Found product", product.id);
//   }

//   const variantNode = product.variants?.nodes?.[0];
//   if (!variantNode?.id || !variantNode?.inventoryItem?.id) {
//     throw new Error(`Missing variant/inventoryItem for product ${product.id}`);
//   }

//   const variantId = variantNode.id;
//   const inventoryItemId = variantNode.inventoryItem.id;

//   // 3) Update core fields + metafields
//   await updateCoreFields(product.id, bike);
//   await setMetafields(product.id, bike);

//   // 4) Price + inventory tracking
//   await updateVariant(product.id, variantId, bike);
//   await enableInventoryTracking(inventoryItemId);

//   // 5) Inventory quantity (0 when sold/reserved)
//   const qty = bike.inStock ? 1 : 0;
// try {
//   await setInventory(inventoryItemId, qty, bike.mobiloxId);
// } catch (e) {
//   console.warn("⚠️ Inventory update failed, continuing to images:", e?.message || e);
// }


//   // 6) Images
//   console.log("🖼️ Mobilox image count:", bike.imageUrls?.length || 0);
//   await syncImages(product.id, bike.imageUrls);

//   return product.id;
// }

// module.exports = { upsertBike };





// mobilox_to_shopify.js
require("dotenv").config({ override: true });
const { shopifyGraphQL } = require("./shopify");

const NS = "custom";
const LOCATION_ID = process.env.SHOPIFY_LOCATION_ID;
// const DEFAULT_STATUS = process.env.PRODUCT_STATUS || "DRAFT";
const DEFAULT_STATUS = "ACTIVE";
function asArray(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

function normalizeUrl(u) {
  if (!u) return "";
  return String(u).trim().replace(/\s+/g, "");
}

/** -------------------------
 *  Product find/create/update
 *  ------------------------- */

async function findProductByMobiloxId(mobiloxId) {
  const query = `
    query($q: String!) {
      products(first: 1, query: $q) {
        nodes {
          id
          title
          variants(first: 1) {
            nodes { id inventoryItem { id } }
          }
        }
      }
    }
  `;
  // const q = `metafield:${NS}.mobilox_id:${mobiloxId}`;
  const q = `metafields.${NS}.mobilox_id:"${mobiloxId}"`;
  const data = await shopifyGraphQL(query, { q });
  return data.products?.nodes?.[0] || null;
}

async function createProductSkeleton(bike) {
  const mutation = `
    mutation($input: ProductInput!) {
      productCreate(input: $input) {
        product {
          id
          title
          variants(first: 1) { nodes { id inventoryItem { id } } }
        }
        userErrors { field message }
      }
    }
  `;

  const variables = {
    input: {
      title: bike.title,
      vendor: bike.brand || "Mobilox",
      productType: "Bike",
      status: DEFAULT_STATUS,
      tags: ["mobilox-sync-zwolle"],
    },
  };

  const res = await shopifyGraphQL(mutation, variables);
  const errs = res.productCreate?.userErrors || [];
  if (errs.length) throw new Error("productCreate: " + JSON.stringify(errs));
  return res.productCreate.product;
}

async function updateCoreFields(productId, bike) {
  const mutation = `
    mutation($input: ProductInput!) {
      productUpdate(input: $input) {
        product { id title }
        userErrors { field message }
      }
    }
  `;

  const variables = {
    input: {
      id: productId,
      title: bike.title,
      descriptionHtml: bike.descriptionHtml || "",
      vendor: bike.brand || "Mobilox",
      productType: "Bike",
      status: DEFAULT_STATUS,
      tags: ["mobilox-sync-zwolle"],
    },
  };

  const res = await shopifyGraphQL(mutation, variables);
  const errs = res.productUpdate?.userErrors || [];
  if (errs.length) throw new Error("productUpdate: " + JSON.stringify(errs));
}

/** -------------------------
 *  Metafields (AUTO type)
 *  ------------------------- */

// cache definitions so we don’t query every product
let metafieldTypeCache = null;

/**
 * Reads your Shopify metafield definitions for PRODUCT in namespace `custom`,
 * returns map: { key -> type } e.g. { kleur_opties: "list.single_line_text_field" }
 */
async function getProductMetafieldTypes() {
  if (metafieldTypeCache) return metafieldTypeCache;

  const query = `
    query($namespace: String!) {
      metafieldDefinitions(first: 250, ownerType: PRODUCT, namespace: $namespace) {
        nodes {
          key
          type { name }
        }
      }
    }
  `;

  const res = await shopifyGraphQL(query, { namespace: NS });
  const nodes = res.metafieldDefinitions?.nodes || [];

  const map = {};
  for (const n of nodes) {
    const key = n?.key;
    const typeName = n?.type?.name; // e.g. "single_line_text_field" or "list.single_line_text_field"
    if (key && typeName) map[key] = typeName;
  }

  metafieldTypeCache = map;
  return map;
}

async function setMetafields(productId, bike) {
  const mutation = `
    mutation($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id namespace key type value }
        userErrors { field message }
      }
    }
  `;

  const types = await getProductMetafieldTypes();

  function addAuto(list, key, value) {
    // allow empty = skip (NO ERROR)
    if (value == null) return;

    // normalize to string/array
    const rawType = types[key] || "single_line_text_field";

    // LIST type → value must be JSON array string
    if (rawType.startsWith("list.")) {
      const arr = Array.isArray(value)
        ? value.map((x) => String(x || "").trim()).filter(Boolean)
        : [String(value || "").trim()].filter(Boolean);

      if (arr.length === 0) return;

      list.push({
        ownerId: productId,
        namespace: NS,
        key,
        type: rawType,                 // IMPORTANT: must match definition exactly
        value: JSON.stringify(arr),    // IMPORTANT: list value must be JSON
      });
      return;
    }

    // Non-list type → plain string
    const v = String(value).trim();
    if (!v) return;

    list.push({
      ownerId: productId,
      namespace: NS,
      key,
      type: rawType, // if your definition is single_line_text_field, this matches
      value: v,
    });
  }

  const metafields = [];

  // Always required
  addAuto(metafields, "mobilox_id", bike.mobiloxId);

  // Optional (skip if empty automatically)
  addAuto(metafields, "condition", bike.condition);
  addAuto(metafields, "frame_size", bike.frameSize);
  addAuto(metafields, "kleur_opties", bike.color);     // ✅ uses your definition automatically
  addAuto(metafields, "Motor", bike.motor);            // ✅ uses your definition automatically
  addAuto(metafields, "battery", bike.battery);
  addAuto(metafields, "availability", bike.availability);
  addAuto(metafields, "model_opties", bike.modelOrig); // ✅ your <model_orig>

  // If only mobilox_id exists, that’s fine.
  const res = await shopifyGraphQL(mutation, { metafields });
  const errs = res.metafieldsSet?.userErrors || [];
  if (errs.length) throw new Error("metafieldsSet: " + JSON.stringify(errs));
}

/** -------------------------
 *  Variant price
 *  ------------------------- */

async function updateVariant(productId, variantId, bike) {
  const mutation = `
    mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        product { id }
        productVariants { id price }
        userErrors { field message }
      }
    }
  `;

  const variables = {
    productId,
    variants: [{ id: variantId, price: String(bike.price || "0.00") }],
  };

  const res = await shopifyGraphQL(mutation, variables);
  const errs = res.productVariantsBulkUpdate?.userErrors || [];
  if (errs.length) throw new Error("productVariantsBulkUpdate: " + JSON.stringify(errs));
}

/** -------------------------
 *  Inventory
 *  ------------------------- */

async function enableInventoryTracking(inventoryItemId) {
  const mutation = `
    mutation inventoryItemUpdate($id: ID!, $input: InventoryItemInput!) {
      inventoryItemUpdate(id: $id, input: $input) {
        inventoryItem { id tracked }
        userErrors { field message }
      }
    }
  `;

  const res = await shopifyGraphQL(mutation, {
    id: inventoryItemId,
    input: { tracked: true },
  });

  const errs = res.inventoryItemUpdate?.userErrors || [];
  if (errs.length) throw new Error("inventoryItemUpdate: " + JSON.stringify(errs));
}

async function inventoryActivateIfNeeded(inventoryItemId, locationId, available = 0) {
  const mutation = `
    mutation ActivateInventory($inventoryItemId: ID!, $locationId: ID!, $available: Int) {
      inventoryActivate(inventoryItemId: $inventoryItemId, locationId: $locationId, available: $available) {
        inventoryLevel { id available }
        userErrors { field message code }
      }
    }
  `;

  const res = await shopifyGraphQL(mutation, { inventoryItemId, locationId, available });
  const errs = res.inventoryActivate?.userErrors || [];
  if (errs.length) throw new Error("inventoryActivate: " + JSON.stringify(errs));
}

async function setInventory(inventoryItemId, qty, mobiloxId) {
  if (!LOCATION_ID) throw new Error("Missing SHOPIFY_LOCATION_ID in .env");

  const mutation = `
    mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
      inventorySetQuantities(input: $input) {
        inventoryAdjustmentGroup { id }
        userErrors { field message code }
      }
    }
  `;

  const variables = {
    input: {
      name: "on_hand", // ✅ MUST be "available" or "on_hand"
      reason: "correction",
      referenceDocumentUri: mobiloxId
        ? `gid://mobilox-connector/Vehicle/${mobiloxId}`
        : `gid://mobilox-connector/SyncJob/${Date.now()}`,

      // for your API version this is valid
      ignoreCompareQuantity: true,

      quantities: [
        {
          inventoryItemId,
          locationId: LOCATION_ID,
          quantity: qty,
        },
      ],
    },
  };

  // 1) Try set
  let res = await shopifyGraphQL(mutation, variables);
  let errs = res.inventorySetQuantities?.userErrors || [];

  // 2) If not stocked at location, activate then retry
  const notStocked =
    errs.some((e) => e.code === "INVENTORY_ITEM_NOT_STOCKED_AT_LOCATION") ||
    errs.some((e) => /stocked at location/i.test(e.message || ""));

  if (notStocked) {
    await inventoryActivateIfNeeded(inventoryItemId, LOCATION_ID, qty);

    res = await shopifyGraphQL(mutation, variables);
    errs = res.inventorySetQuantities?.userErrors || [];
  }

  if (errs.length) {
    throw new Error("inventorySetQuantities userErrors: " + JSON.stringify(errs));
  }
}

/** -------------------------
 *  Images (your working version)
 *  ------------------------- */

async function syncImages(productId, imageUrls) {
  const urls = asArray(imageUrls)
    .map(normalizeUrl)
    .filter((u) => u && /^https?:\/\//i.test(u));

  if (urls.length === 0) return;

  const q = `
    query($id: ID!) {
      product(id: $id) {
        media(first: 100) {
          nodes {
            ... on MediaImage {
              id
              image { altText url }
            }
          }
        }
      }
    }
  `;

  const existing = await shopifyGraphQL(q, { id: productId });

  // const existingAlts = new Set(
  //   (existing.product?.media?.nodes || [])
  //     .map((m) => m?.image?.altText)
  //     .filter(Boolean)
  // );

  // const toAdd = urls.filter((u) => !existingAlts.has(u));
  const existingAlts = new Set(
    (existing.product?.media?.nodes || [])
      .map((m) => normalizeUrl(m?.image?.altText))
      .filter(Boolean)
  );
  
  const toAdd = urls.filter((u) => !existingAlts.has(normalizeUrl(u)));
  if (toAdd.length === 0) return;

  const mutation = `
    mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
      productCreateMedia(productId: $productId, media: $media) {
        media { ... on MediaImage { id } }
        mediaUserErrors { field message }
      }
    }
  `;

  const BATCH_SIZE = Number(process.env.IMAGE_BATCH_SIZE || 5);

  for (let i = 0; i < toAdd.length; i += BATCH_SIZE) {
    const batch = toAdd.slice(i, i + BATCH_SIZE);

    const variables = {
      productId,
      media: batch.map((u) => ({
        mediaContentType: "IMAGE",
        originalSource: u,
        alt: u,
      })),
    };

    const res = await shopifyGraphQL(mutation, variables);
    const errs = res.productCreateMedia?.mediaUserErrors || [];
    if (errs.length) console.warn("⚠️ productCreateMedia errors:", { productId, errs, batch });
  }
}
// ---- Publish to Online Store ----
let onlineStorePublicationIdCache = null;

async function getOnlineStorePublicationId() {
  if (onlineStorePublicationIdCache) return onlineStorePublicationIdCache;

  const q = `
    query {
      publications(first: 50) {
        nodes {
          id
          name
        }
      }
    }
  `;

  const res = await shopifyGraphQL(q, {});
  const pubs = res.publications?.nodes || [];

  // Shopify usually names it "Online Store"
  const online = pubs.find(p => (p.name || "").toLowerCase() === "online store");
  if (!online?.id) throw new Error("Online Store publication not found. Check Sales channels enabled.");
  onlineStorePublicationIdCache = online.id;
  return online.id;
}

async function publishToOnlineStore(productId) {
  const publicationId = await getOnlineStorePublicationId();

  const mutation = `
    mutation publish($id: ID!, $input: [PublicationInput!]!) {
      publishablePublish(id: $id, input: $input) {
        userErrors { field message }
      }
    }
  `;

  const variables = {
    id: productId,
    input: [{ publicationId }],
  };

  const res = await shopifyGraphQL(mutation, variables);
  const errs = res.publishablePublish?.userErrors || [];
  if (errs.length) throw new Error("publishablePublish: " + JSON.stringify(errs));
}
/** -------------------------
 *  Upsert
 *  ------------------------- */

async function upsertBike(bike) {
  if (!bike?.mobiloxId) throw new Error("upsertBike: missing bike.mobiloxId");

  let product = await findProductByMobiloxId(bike.mobiloxId);

  if (!product) {
    product = await createProductSkeleton(bike);
    console.log("🆕 Created product", product.id);
  } else {
    console.log("🔁 Found product", product.id);
  }

  const variantNode = product.variants?.nodes?.[0];
  if (!variantNode?.id || !variantNode?.inventoryItem?.id) {
    throw new Error(`Missing variant/inventoryItem for product ${product.id}`);
  }

  const variantId = variantNode.id;
  const inventoryItemId = variantNode.inventoryItem.id;

  await updateCoreFields(product.id, bike);
  
  await setMetafields(product.id, bike);

  await updateVariant(product.id, variantId, bike);
  await enableInventoryTracking(inventoryItemId);

  const qty = bike.inStock ? 1 : 0;
  try {
    await setInventory(inventoryItemId, qty, bike.mobiloxId);
  } catch (e) {
    console.warn("⚠️ Inventory update failed, continuing to images:", e?.message || e);
  }

  console.log("🖼️ Mobilox image count:", bike.imageUrls?.length || 0);
  await syncImages(product.id, bike.imageUrls);

  return product.id;
}

module.exports = { upsertBike };