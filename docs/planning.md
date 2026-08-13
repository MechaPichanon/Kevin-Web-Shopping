# Thesis Project Review — Full E-Commerce Comparison & What to Improve

> Full project review as of 2026-07-02. Compares against a standard e-commerce website to identify thesis-level completeness.
> **Updated 2026-07-16** — see "PROGRESS UPDATE (2026-07-16)" section near the top of the Progress Tracker for what changed since Jul 2. Tables/prose below this line are the original Jul 2 snapshot and are now partly stale — trust the 07-16 update section over them where they conflict.

---

## How This Project Compares to a Standard E-Commerce Website

A typical e-commerce site (Shopee, ASOS, any mid-size store) has three layers: **Customer Experience**, **Admin Operations**, and **Technical Foundation**. Here's an honest comparison:

### Customer Experience

| Feature | Standard E-Commerce | This Project |
|---------|-------------------|--------------|
| Home page with hero + featured products | ✅ Required | ⚠️ Only shows recommendations, no hero |
| Product listing with filters | ✅ Required | ✅ Done — category, subcategory, price range |
| **Product detail page** | ✅ Required | ❌ Missing — no `/products/[id]` page |
| Image gallery per product/color | ✅ Required | ⚠️ Images exist in DB, no detail page to show them |
| Size guide / measurements | ✅ Required | ✅ Done via chatbot; not on product page |
| Text search | ✅ Required | ✅ Done |
| **AI chatbot** | ❌ Not standard (premium feature) | ✅ Done — thesis differentiator |
| **Visual/image search** | ❌ Not standard (premium feature) | ⚠️ 0% backend — thesis differentiator not working |
| Shopping cart — add item | ✅ Required | ✅ Done |
| **Shopping cart — remove / update qty** | ✅ Required | ❌ Missing |
| Checkout with shipping info | ✅ Required | ✅ Done |
| Payment processing | ✅ Required | ❌ No real gateway — placeholder only |
| Order confirmation | ✅ Required | ✅ Done (shows order ID) |
| **Order history for customers** | ✅ Required | ❌ Missing |
| Order status tracking | ✅ Required | ❌ Missing |
| **Product reviews / ratings** | ✅ Required | ❌ Missing (table in DB, no endpoints/UI) |
| Wishlist / favorites | Common | ❌ Missing (commented out) |
| Coupon / discount codes | Common | ❌ Missing (table exists, no validation) |
| Multiple saved addresses | Common | ❌ Missing (table exists, no endpoints) |
| Email notifications | Common | ❌ Missing entirely |

### Admin Operations

| Feature | Standard E-Commerce | This Project |
|---------|-------------------|--------------|
| Dashboard — sales stats | ✅ Required | ✅ Done (real data) |
| Dashboard — trend % vs last period | Common | ❌ Hardcoded fake numbers |
| **Product management** (CRUD + variants + images) | ✅ Required | ✅ Done — very complete |
| **Order management** (list, filter, update status) | ✅ Required | ❌ Missing — page doesn't exist |
| User management (roles, disable) | ✅ Required | ✅ Done |
| Reviews moderation | Common | ❌ Missing |
| Discount / coupon management | Common | ❌ Missing |
| Inventory alerts (low stock) | Common | ❌ Missing |
| Sales reports / export | Advanced | ❌ Missing |

### Technical Foundation

| Feature | Standard E-Commerce | This Project |
|---------|-------------------|--------------|
| User authentication (JWT) | ✅ Required | ✅ Done |
| Password security (bcrypt) | ✅ Required | ✅ Done |
| Role-based access (admin/staff/customer) | ✅ Required | ✅ Done |
| Input validation | ✅ Required | ❌ Missing |
| Rate limiting on auth | ✅ Required | ❌ Missing |
| HTTPS / secure cookies | Production | ❌ Dev only |
| Docker Compose deployment | — | ✅ Done |
| pgvector / AI DB | — | ✅ Done — thesis feature |
| Password reset email | Common | ❌ Missing |
| Email verification | Common | ❌ Missing |

---

### Verdict: Where This Project Stands

**Strong areas** (above average for a thesis):
- Admin product management is very thorough — full variant system with Thai names, measurements, color-keyed images. Better than many real stores.
- Database schema is well-designed with proper normalization, soft deletes, and pgvector.
- Chatbot RAG pipeline is genuinely good — hybrid scoring, Thai/English, intent classification.
- Full Docker Compose setup is professional.

**Where it falls short of "complete e-commerce":**
The project is missing 4 standard features that are on every real e-commerce site: a product detail page, cart management (remove/update), order history for customers, and admin order management. These are so fundamental that their absence makes the shopping flow incomplete — a user literally cannot finish shopping without them.

**The two thesis AI features** (chatbot ✅ and image search ❌) are what make this different from a generic school project. Chatbot is done. Image search is 0% and is a gap the committee will ask about.

---

---

## What's Already Working Well

| Area | Status |
|------|--------|
| User auth (register, login, JWT) | ✅ Done |
| Product CRUD + variants + images (admin) | ✅ Done |
| Product listing with category/price filters | ✅ Done |
| Add to cart | ✅ Done |
| Create order (basic, transactional) | ✅ Done |
| Admin dashboard stats (real data) | ✅ Done |
| Admin user management (role/status) | ✅ Done |
| Chatbot RAG pipeline (hybrid search, Thai/English, intents) | ✅ Done |
| Database schema (14 tables, pgvector ready) | ✅ Done |
| Docker Compose full stack | ✅ Done |

---

## CRITICAL GAPS — These Break the Shopping Flow

These must be fixed before a thesis demo. Without them, the app cannot demonstrate a complete purchase cycle.

### 1. No Product Detail Page (Frontend — Friend's side)
**Impact:** Users see products in a grid but clicking goes nowhere. They cannot read specs, pick a size/color/variant, or understand what they're buying before adding to cart.
**Fix:** Create `frontend/app/products/[id]/page.tsx` showing product name, description, all variants (size, color, price, stock), measurements, and images per color.

### 2. Cart Cannot Remove Items or Update Quantity (Backend + Frontend)
**Impact:** A user who adds the wrong item is stuck. The shopping cart is effectively broken.

- **Backend missing:** `DELETE /cart/:cartItemId` and `PUT /cart/:cartItemId` (quantity update)
- **Frontend missing:** Remove button and quantity +/− controls presumably call these missing endpoints
- **Fix (user's friend):** Add the two endpoints to `backend/routes/cartRoutes.js` + `cartControllers.js`

### 3. Users Cannot See Their Order History (Backend + Frontend)
**Impact:** After placing an order, the confirmation screen shows an order ID — but there is no page to go back and view it. Users cannot track anything.

- **Backend missing:** `GET /orders/user/:userId` and `GET /orders/:orderId` 
- **Frontend missing:** Orders tab in profile (commented out, says "coming soon")
- **Fix (friend):** Add order list + detail endpoints to `orderRoutes.js` / `orderControllers.js`, then build the orders page in profile

### 4. Admin Has No Orders Management Page (Frontend — Friend's side)
**Impact:** Admin nav links to `/admin/orders` but the page doesn't exist. Admin cannot see, filter, or update order status.
**Backend gap:** `GET /admin/orders` and `PUT /admin/orders/:id/status` are also missing.
**Fix:** Create `frontend/app/admin/orders/page.tsx` + add the two backend endpoints.

### 5. Image Search — Zero Backend Implementation (User's side)
**Impact:** The chatbot widget is the main AI feature, but visual search (the other AI thesis feature) does not work at all. The DB table is ready but no CLIP code exists.
**Fix:** See the earlier plan — `image_search.py`, `/image-search` endpoint, backfill script. Frontend UI is friend's side.

---

## IMPORTANT GAPS — Thesis Presentation Weaknesses

These won't crash the demo but will be noticed by a committee.

### 6. Chatbot Has No Conversation Memory (User's side)
Each message is sent to the LLM with zero history. If a user asks "show me shirts" then "which is cheapest?", the second question fails.
**Fix:** Add message history to `_CONVERSATIONS` in `main.py` (see earlier plan Task 2).

### 7. Payment Is Completely Simulated
The checkout page lets users pick "Credit Card" or "Bank Transfer" but no money moves. The payment record in the DB is just a placeholder string.
**Recommendation for thesis:** Use **COD (Cash on Delivery) as the primary method** and note in your thesis that a real gateway (Omise is popular in Thailand) would replace the stub. This is acceptable for a thesis scope — just be upfront about it in the paper.

### 8. Homepage Is Nearly Empty
`app/page.tsx` only renders `<Recommendation />`. There is no hero section, no featured categories, no promotional banner. First impression is weak.
**Fix (friend's side):** Add a hero section with a call-to-action, featured categories strip, and the recommendation component below.

### 9. Reviews System Is Unused
The `reviews` table exists with an approval workflow in the schema, but there are zero endpoints and zero UI. Product pages (once built) should show reviews.
**Fix:** 
- Backend: `GET /products/:id/reviews`, `POST /reviews` (authenticated), `PUT /admin/reviews/:id/approve`
- Frontend: Review list + submit form on product detail page

### 10. Discount Codes Are Not Validated at Checkout
The `discount_codes` table exists and seed data has codes, but checkout never calls a validation endpoint. The coupon field in checkout (if it exists) does nothing.
**Fix:**
- Backend: `POST /discounts/validate` (check code, expiry, min_order, usage limit)
- Frontend: Coupon input in checkout that reduces total on success

### 11. Admin Dashboard Percentages Are Hardcoded
The four stat cards show "+12.5%", "+8.2%" etc. as static values — they are not calculated from real data.
**Fix (backend):** Extend `/admin/stats` to return comparison vs yesterday/last week. Minor change.

---

## SECURITY ISSUES (Important for Thesis Report)

Mention these in your thesis limitations section:

| Issue | Location | Fix |
|-------|----------|-----|
| `/admin/orders/recent` has no admin check | `server.js` | Add `requireAdmin` middleware to that route |
| CORS hardcoded to `localhost:3000` | `server.js` | Use env var for production |
| No rate limiting on auth endpoints | `server.js` | Add `express-rate-limit` |
| No input sanitization | All routes | Add validation (zod or joi) |
| JWT never invalidated on logout | `server.js` | Token blacklist or short expiry |
| `routes/auth.js` exists but is never mounted | Backend | Delete the dead file |

---

## MINOR / NICE-TO-HAVE

These are polish items — do them only after the critical gaps are fixed.

- **Profile picture upload** — button exists, not wired up
- **Wishlist** — commented out in profile; table not in schema (would need migration + endpoints)
- **Address management** — commented out; `addresses` table exists, endpoints missing
- **`lib/mockdata.ts`** — completely unused, should be deleted to avoid confusion
- **`routes/auth.js`** — unused dead file, delete it
- **Admin settings page** — nav links to it but page doesn't exist
- **Password reset** — no `/auth/forgot-password` flow
- **Server-side search** — currently fetches ALL products then filters client-side; fine for small catalog, but note in thesis

---

---

## Fix: Product Search Page

**File:** `frontend/app/search/page.tsx`

### Problem
The page calls `fetch("http://localhost:5000/products")` (all products, no query), then filters client-side on only `product_name` and `category`. The real backend search endpoint `GET /products/search?q=...` exists and searches 16 fields but is never called.

### What needs to change (3 things)

**1. Change the fetch URL to use the real search endpoint:**
```js
// Before (line 24)
fetch("http://localhost:5000/products")

// After
fetch(`http://localhost:5000/products/search?q=${encodeURIComponent(search)}`)
```

**2. Add `search` as a `useEffect` dependency so it re-fetches when the query changes:**
```js
// Before
useEffect(() => { ... }, [])

// After
useEffect(() => {
  if (!search.trim()) {
    setProducts([])
    return
  }
  fetch(`http://localhost:5000/products/search?q=${encodeURIComponent(search)}`)
    .then(res => res.json())
    .then(setProducts)
    .catch(console.error)
}, [search])
```

**3. Remove the client-side `filteredProducts` filter — the backend now filters:**
```js
// Before
const filteredProducts = products.filter(...)

// After — use products directly in the render
// (rename filteredProducts → products everywhere in the JSX)
```

### Response type — no change needed
`/products/search` returns the same fields as `/products` (plus extras like `description` — the existing `ProductApi` type already works).

### What the search can find after fix
| Can search by | Before | After |
|--------------|--------|-------|
| Product name (EN) | ✅ | ✅ |
| Category | ✅ | ✅ |
| Product name (TH) | ❌ | ✅ |
| Category (TH) | ❌ | ✅ |
| Description | ❌ | ✅ |
| Color | ❌ | ✅ |
| Pattern | ❌ | ✅ |
| Sleeve type | ❌ | ✅ |
| Collar type | ❌ | ✅ |

---

## Gantt Chart — Timeline to September 2026

**Start:** July 2, 2026 · **Target:** End of September 2026 (13 weeks)
**Legend:** 🟦 You · 🟩 Friend · 🟨 Both · `████` active · `····` not yet

```
TASK                              OWNER   | Jul W1 | Jul W2 | Jul W3 | Jul W4 | Aug W1 | Aug W2 | Aug W3 | Aug W4 | Sep W1 | Sep W2 | Sep W3 | Sep W4 | Sep W5
                                          | Jul2-8 | Jul9-15| Jul16  | Jul23  | Jul30  | Aug6   | Aug13  | Aug20  | Aug27  | Sep3   | Sep10  | Sep17  | Sep24
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
MUST COMPLETE
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
Fix demo_retrieval.py (30 min)    🟦 You  | ██     | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····
Fix admin/orders/recent auth      🟩 Friend| ██     | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····
Product detail page /products/[id]🟦 You  | ████   | ████   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····
Cart remove + update quantity     🟩 Friend| ████   | ████   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····
Chatbot conversation history      🟦 You  | ····   | ████   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····
Order history endpoints + page    🟩 Friend| ····   | ████   | ████   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····
Admin orders page + endpoints     🟩 Friend| ····   | ····   | ████   | ████   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····
Image search backend (CLIP)       🟦 You  | ····   | ····   | ████   | ████   | ████   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
SHOULD COMPLETE
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
Homepage hero + featured section  🟩 Friend| ····   | ····   | ····   | ····   | ████   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····
Reviews — backend endpoints       🟦 You  | ····   | ····   | ····   | ····   | ····   | ████   | ····   | ····   | ····   | ····   | ····   | ····   | ····
Reviews — frontend (product page) 🟩 Friend| ····   | ····   | ····   | ····   | ····   | ████   | ████   | ····   | ····   | ····   | ····   | ····   | ····
Discount validation endpoint      🟦 You  | ····   | ····   | ····   | ····   | ····   | ····   | ████   | ····   | ····   | ····   | ····   | ····   | ····
Discount UI at checkout           🟩 Friend| ····   | ····   | ····   | ····   | ····   | ····   | ████   | ····   | ····   | ····   | ····   | ····   | ····
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
INTEGRATION & TESTING
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
Integration testing + bug fixes   🟨 Both | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ████   | ████   | ····   | ····   | ····   | ····
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
DEPLOYMENT  (target: Oracle Cloud Always Free ARM — 4 CPU / 24 GB RAM)
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
Phase 1 — DB + Data deploy        🟨 Both | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ████   | ····   | ····   | ····
  Oracle ARM: PostgreSQL up,
  migrations, import_products,
  backfill embeddings (text+CLIP),
  seed data, copy uploads/ folder
  (bind mount on server disk)
Phase 2 — App deploy              🟨 Both | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ████   | ····   | ····
  Docker Compose: Next.js +
  Express + FastAPI + Ollama;
  set .env (OPENROUTER_API_KEY,
  DATABASE_URL, JWT_SECRET)
Smoke test on live server         🟨 Both | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ████   | ····
BUFFER / Polish / Thesis writing  🟨 Both | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ····   | ████
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
```

### Milestones
| Date | Milestone |
|------|-----------|
| **Jul 15** | Product page done · Cart working (add/remove/update) |
| **Jul 29** | Order history live · Admin can manage orders · Chatbot has memory |
| **Aug 5**  | Image search backend complete (CLIP + endpoint + backfill) |
| **Aug 19** | Reviews live · Discount codes working · Homepage has hero |
| **Aug 26** | ✅ All must-have + should-have features complete |
| **Sep 9**  | Integration tested, bugs fixed |
| **Sep 10** | 🚀 **Phase 1 Deploy** — PostgreSQL live on server, products + embeddings imported |
| **Sep 17** | 🚀 **Phase 2 Deploy** — Next.js + Express + FastAPI running on server |
| **Sep 23** | ✅ Smoke test on live server passes |
| **Sep 30** | 🎓 Thesis submission ready with buffer |

### Deployment Plan

**Primary Platform:** Oracle Cloud Always Free ARM — 4 CPU, 24 GB RAM, 200 GB disk — free forever
**Fallback (if Oracle capacity unavailable):** Google Cloud $300 credit (90 days, covers Jul–Sep) → Railway ($5–10/month) → DigitalOcean ($12/month)
**Note:** Oracle ARM is in high demand — if "Out of capacity" error persists over 1 week, switch to fallback immediately to not delay Sep deploy.

---

#### What Goes Where

| Component | Where | Notes |
|-----------|-------|-------|
| PostgreSQL + pgvector | Oracle Cloud (Docker) | Named volume for DB data |
| Next.js frontend | Oracle Cloud (Docker) | Port 3000 |
| Express backend | Oracle Cloud (Docker) | Port 5000 |
| FastAPI chatbot | Oracle Cloud (Docker) | Port 8000 |
| Ollama (bge-m3) | Oracle Cloud (Docker) | Only needed when adding new products |
| **Image files** | **Bind mount on Oracle disk** | `./backend/uploads` → server disk (200 GB free) |
| **Image files (upgrade)** | **Cloudflare R2** | 10 GB free, CDN-backed — migrate after thesis if needed |
| Chat LLM | OpenRouter API (external) | Just an API key in `.env`, no server |
| CLIP model | Inside FastAPI container | Downloads on first `/image-search` request |

---

#### Phase 1 — Database & Data (Sep 10)
1. Provision Oracle Cloud ARM instance, install Docker + Docker Compose
2. Clone repo onto server
3. Add bind mount to `docker-compose.yml`: `./backend/uploads:/app/backend/uploads`
4. `docker compose up postgres` — start DB only
5. Apply migrations 002–008
6. `node backend/scripts/import_products.js` — products + variants
7. `node backend/scripts/backfill_chunk_embeddings.js` — text embeddings (needs Ollama running)
8. `python backend/scripts/backfill_image_embeddings.py` — CLIP image embeddings
9. `psql -f backend/scripts/seed_database.sql` — users, policies, discount codes
10. Copy existing image files: `scp -r backend/uploads/ ubuntu@server:~/app/backend/uploads/`
11. Verify: connect to DB, check row counts in all tables

#### Phase 2 — App (Sep 17)
1. Set production `.env`:
   - `DATABASE_URL` → Oracle DB
   - `JWT_SECRET` → strong random string
   - `OPENROUTER_API_KEY` → your key (replaces Ollama chat)
   - `OLLAMA_BASE_URL` → `http://ollama:11434` (for embeddings only)
2. `docker compose up --build` — all services start
3. Open port 3000 to public
4. Test: visit site, try chatbot, upload test image search

#### Demo Day
- Run entire stack **locally** for the presentation — fastest, no network dependency
- Oracle Cloud deploy = for committee access / grading URL

---

#### Image Storage Upgrade Path (post-thesis)
When ready to move from bind mount → Cloudflare R2:
1. Create R2 bucket (free, 10 GB)
2. Replace multer local save in Express with R2 SDK upload
3. Update `image_url` values in DB to R2 URLs
4. Remove bind mount from `docker-compose.yml`

### Week-by-Week Summary
| Week | You (User) | Friend |
|------|-----------|--------|
| Jul W1 | Fix demo_retrieval.py · Start product detail page | Fix admin auth bug · Start cart remove/update |
| Jul W2 | Finish product detail page · Add chatbot history | Finish cart · Start order history |
| Jul W3 | Start image search (CLIP setup, image_search.py) | Finish order history · Start admin orders page |
| Jul W4 | Image search endpoints in main.py | Finish admin orders page |
| Aug W1 | Backfill script + test image search end-to-end | Homepage hero |
| Aug W2 | Reviews backend (3 endpoints) | Reviews frontend on product page |
| Aug W3 | Discount validation endpoint | Reviews frontend done · Discount checkout UI |
| Aug W4 | Integration testing together | Integration testing together |
| Sep W1 | Integration testing + bug fixes | Integration testing + bug fixes |
| Sep W2–W5 | Buffer: polish, extra features, thesis writing | Buffer: polish, extra features |

---

## PROGRESS UPDATE (2026-07-16)

> Checked against actual code (git log + file contents), not just recollection. This supersedes the checklist below where they disagree — the checklist has also been updated to match.

**Done since Jul 2 (matches Jul W1–W2 plan almost exactly):**
- ✅ **Cart remove + update quantity** — `DELETE /cart/:cart_item_id` + `PUT /cart/:cart_item_id` wired in `cartRoutes.js`/`cartControllers.js`; `frontend/app/cart/page.tsx` has working +/− and remove buttons. Fully done, committed.
- ✅ **Admin orders page** — `frontend/app/admin/orders/page.tsx` exists with status filter, status/payment update UI; backend has `GET /orders/admin`, `GET /orders/admin/:id`, `PATCH /orders/admin/:id/status`, `PATCH /orders/admin/:id/payment-status`. Fully done, committed (`c4e2071 update order things`).
- 🟡 **Product detail page** `frontend/app/products/[productId]/page.tsx` — color/size variant picker, image gallery synced to color, add-to-cart, reviews block. Very complete but **currently uncommitted** (working tree changes) along with the new `getProductById` endpoint (`backend/controllers/productControllers.js`) and `GET /products/:productId` route. Needs testing + a commit.
- 🟡 **Reviews — read path only** — `backend/controllers/reviewControllers.js` (new, untracked) implements `GET /products/:productId/reviews` (avg rating + approved review list), wired into `productRoutes.js` and consumed by the product detail page. **Still missing:** `POST /reviews` (submit) and admin approve endpoint — nothing to actually create a review yet, so the UI has nothing to display beyond seed data.

**Still not started:**
- ❌ **Order history for customers** (`GET /orders/user/:userId`) — no such function exists in `orderControllers.js` (only `createOrder`, admin-side `getAllOrders`/`getOrderById`/`updateOrderStatus`/`updatePaymentStatus`). Profile "orders" tab still has nothing to call.
- ❌ **Image search backend** — no `backend/chatbot/image_search.py` file exists yet. 0% as before.
- ❌ **Chatbot conversation history** — `_CONVERSATIONS` in `main.py` still only stores `last_active` + `last_products` (for pronoun/follow-up resolution), not a real message history sent back to the LLM. Multi-turn reasoning beyond "which is cheapest" style follow-ups still won't work.
- ❌ **`demo_retrieval.py` field-name bug** — confirmed still present. It reads `p.get('name')`, `p.get('price')`, `p.get('currency')`, but `retrieval.py`'s `load_products()` only returns `product_name` (no `name` alias) and no top-level `price`/`currency` at all (price lives per-variant). Still a 10-min fix.
- ❌ Discount code validation, homepage hero, admin `/admin/orders/recent` auth fix — no evidence of work; unchanged from Jul 2.

**Note on migrations:** commit `71898c6 add new migration` edited `004_user_role.sql` in place rather than adding `009_description.sql` per the CLAUDE.md convention (numbered, additive migrations). Worth a quick check that this didn't break already-migrated environments — if `004` already ran on any existing DB, editing it in place won't re-apply the new statements there.

## PROGRESS TRACKER — Check Off as Completed

> Update this list as each item is done. This is the official completion checklist for the thesis project.

### Must Complete (Breaks Demo Without These)

- [x] **Cart remove + update quantity** — backend endpoints + frontend controls (Friend) ✅ done
- [ ] **Product detail page** `/products/[id]` — show variants, images, measurements (Friend) — 🟡 built, uncommitted, needs testing + commit
- [ ] **Order history** — `GET /orders/user/:userId` endpoint + profile orders tab (Friend)
- [x] **Admin orders page** — `/admin/orders` page + list/status-update endpoints (Friend) ✅ done
- [ ] **Image search backend** — `image_search.py`, `/image-search` endpoint, backfill script (User)

### Should Complete (Impresses Committee)

- [x] **Chatbot conversation history** — add message history to `main.py` (User) ✅ done 2026-07-16, verified via two chained `/chat` calls (follow-up correctly referenced prior turn's specific products)
- [ ] **Homepage** — hero section + featured categories (Friend)
- [ ] **Reviews** — `GET/POST /products/:id/reviews` + approve endpoint + product page UI (Both) — 🟡 GET done (uncommitted), POST + approve still missing
- [ ] **Discount code validation** — `POST /discounts/validate` + checkout coupon input (Both)
- [ ] **Fix `/admin/orders/recent` auth** — add `requireAdmin` middleware (Friend — 1 line)
- [x] **Fix `demo_retrieval.py`** — wrong field names (User — 10 min) ✅ done 2026-07-16

### Nice to Have (If Time Permits)

- [ ] Admin dashboard % change from real data (Friend)
- [ ] Wishlist — new `wishlists` table (migration 009) + endpoints + UI (Both)
- [ ] Address management — endpoints + profile UI (Both)
- [ ] Profile picture upload (Friend)
- [ ] Delete dead files: `lib/mockdata.ts`, `routes/auth.js` (Friend — cleanup)
- [x] **Fix search page** — done: now calls real backend search + filters added ✅
- [ ] Admin settings page (Friend)

### Write as "Future Work" in Thesis Paper

- Real payment gateway (Omise, Stripe)
- Rate limiting + input validation
- Email notifications (order confirmation, password reset)
- Persistent chatbot sessions (DB-backed)
- Inventory low-stock alerts
- HTTPS / production security hardening

---

## Quick Summary: Who Does What

| Task | Owner |
|------|-------|
| Image search backend (CLIP + endpoints + backfill) | **User** |
| Chatbot conversation history | **User** |
| Fix `demo_retrieval.py` | **User** |
| Cart remove/update endpoints | **Friend** |
| Product detail page | **Friend** |
| Order history endpoints + page | **Friend** |
| Admin orders page + endpoints | **Friend** |
| Reviews endpoints + UI | **Both** |
| Discount validation endpoint + checkout UI | **Both** |
| Homepage hero section | **Friend** |
| Fix `/admin/orders/recent` auth | **Friend (1 line)** |
| Delete `mockdata.ts` + unused `routes/auth.js` | **Friend (cleanup)** |
