// Live API checks from the specification's testing plan (RBAC and price protection,
// concurrent numbering, snapshot integrity). Run against a running API with seeded data:
//   API_URL=http://localhost:4000/api ADMIN_EMAIL=... ADMIN_PASSWORD=... USER_EMAIL=... USER_PASSWORD=... npm run test:api
// USER_* must be a QUOTATION_USER account. Creates test quotations (subject "API-TEST").
const API = process.env.API_URL || "http://localhost:4000/api";
const need = ["ADMIN_EMAIL", "ADMIN_PASSWORD", "USER_EMAIL", "USER_PASSWORD"];
for (const k of need) if (!process.env[k]) { console.error(`Missing ${k}`); process.exit(2); }

let failures = 0;
const ok = (cond, label) => { console.log(`${cond ? "PASS" : "FAIL"}  ${label}`); if (!cond) failures++; };

async function session(email, password) {
  const res = await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  if (!res.ok) throw new Error(`Login failed for ${email}: ${res.status}`);
  const cookies = res.headers.getSetCookie().map(c => c.split(";")[0]);
  const csrf = decodeURIComponent((cookies.find(c => c.startsWith("qm_csrf=")) || "").split("=")[1] || "");
  const cookie = cookies.join("; ");
  const call = (method, url, body) => fetch(`${API}${url}`, { method, headers: { "Content-Type": "application/json", Cookie: cookie, "x-csrf-token": csrf }, body: body ? JSON.stringify(body) : undefined });
  return { call, json: async (m, u, b) => { const r = await call(m, u, b); return { status: r.status, body: await r.json().catch(() => ({})) }; } };
}

const admin = await session(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
const user = await session(process.env.USER_EMAIL, process.env.USER_PASSWORD);

const customers = (await admin.json("GET", "/customers")).body;
const templates = (await admin.json("GET", "/templates")).body;
const products = (await admin.json("GET", "/products?all=true")).body.filter(p => p.status === "ACTIVE" && p.prices?.[0]);
if (!customers.length || !templates.length || !products.length) { console.error("Seed data missing (customer, template, product)"); process.exit(2); }
const product = products[0];
const approved = Number(product.prices[0].unitPrice);
const today = new Date().toISOString().slice(0, 10), later = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
const base = (items) => ({ customerId: customers[0].id, templateId: templates[0].id, quotationDate: today, validUntil: later, subject: "API-TEST", deliveryTerms: "As agreed", paymentTerms: "50% advance", terms: "Test terms", items });
const qty = Math.max(1, Number(product.moq));

// 1. RBAC: a Quotation User cannot change products, prices, rules, users or read the audit log.
ok((await user.json("PUT", `/products/${product.id}`, { ...product, unitPrice: 1, listPrice: 1 })).status === 403, "Quotation User cannot edit products/prices (403)");
ok((await user.json("GET", "/audit-logs")).status === 403, "Quotation User cannot read the audit log (403)");
ok((await user.json("GET", "/users")).status === 403, "Quotation User cannot list users (403)");
ok((await user.json("PUT", `/products/${product.id}/image`, { imageData: "data:image/png;base64,AAAA" })).status === 403, "Quotation User cannot upload product pictures (403)");

// 2. Price protection: a crafted request with a lower price/higher discount must not change the saved price.
const crafted = await user.json("POST", "/quotations", base([{ productId: product.id, quantity: qty, unitPrice: 1, discountRate: 99 }]));
if (crafted.status >= 400) ok(true, `Crafted price/discount rejected (${crafted.status})`);
else {
  const row = (await admin.json("GET", `/quotations/${crafted.body.id}`)).body.items[0];
  ok(Number(row.unitPrice) === approved, "Crafted unit price ignored: saved price equals the approved price");
  ok(Number(row.discountRate) !== 99, "Crafted discount ignored");
}

// 3. Numbering: concurrent saves never produce duplicate numbers.
const batch = await Promise.all(Array.from({ length: 10 }, () => admin.json("POST", "/quotations", base([{ productId: product.id, quantity: qty }]))));
const numbers = batch.filter(r => r.status < 300).map(r => r.body.quotationNumber);
ok(numbers.length === 10 && new Set(numbers).size === 10, `10 concurrent saves gave 10 unique numbers (${numbers.length} saved)`);

// 4. Snapshot integrity: changing the product price later does not change an issued quotation.
const issued = batch.find(r => r.status < 300)?.body;
if (issued) {
  const before = (await admin.json("GET", `/quotations/${issued.id}`)).body.items[0];
  const p = (await admin.json("GET", "/products?all=true")).body.find(x => x.id === product.id);
  const bumped = await admin.json("PUT", `/products/${product.id}`, { sku: p.sku, name: p.name, description: p.description, packageSize: p.packageSize, uom: p.uom, moq: Number(p.moq), gstRate: Number(p.gstRate), listPrice: approved + 100, unitPrice: approved + 100, defaultDiscount: Number(p.prices[0].defaultDiscount) });
  const after = (await admin.json("GET", `/quotations/${issued.id}`)).body.items[0];
  ok(bumped.status < 300 && Number(after.unitPrice) === Number(before.unitPrice), "Existing quotation keeps its original price after the product price changes");
  // restore the original price
  await admin.json("PUT", `/products/${product.id}`, { sku: p.sku, name: p.name, description: p.description, packageSize: p.packageSize, uom: p.uom, moq: Number(p.moq), gstRate: Number(p.gstRate), listPrice: Number(p.prices[0].listPrice), unitPrice: approved, defaultDiscount: Number(p.prices[0].defaultDiscount) });
}

// 5. Authentication: no session, no data.
const anon = await fetch(`${API}/products`);
ok(anon.status === 401, "Anonymous request is rejected (401)");

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
