# AURUM Backend

REST API for the AURUM luxury-jewellery storefront.

**Stack:** Node 20 · Express · TypeScript · Prisma (PostgreSQL) · Redis · Stripe · SendGrid · AWS S3 · JWT

## Quick start

```bash
npm install
cp .env.example .env.local        # then fill in values (see the Setup Guide)
docker run --name aurum-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=aurum_dev -p 5432:5432 -d postgres:15
docker run --name aurum-redis -p 6379:6379 -d redis:7-alpine
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run seed
npm run dev
```

Server runs on **http://localhost:8080**. Health check:

```bash
curl http://localhost:8080/api/health          # { "status": "ok" }
curl http://localhost:8080/api/admin/health     # { "database": "connected", "redis": "connected" }
```

> The API loads env from `.env` / `.env.local` (dotenv). Stripe, SendGrid, and S3
> degrade gracefully when keys are absent — those endpoints return `503` and the
> rest of the API keeps working, so you can develop without every credential.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start with hot reload (tsx) |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run the compiled server |
| `npm run prisma:migrate` | Create/apply a dev migration |
| `npm run seed` | Seed collections, products, shipping methods, admin |
| `npm run typecheck` | Type-check without emitting |

## API surface

```
GET    /api/health                         liveness
GET    /api/health/ready                    db + redis readiness
GET    /api/admin/health                    db + redis (setup-guide alias)

POST   /api/auth/register | login | logout
GET    /api/auth/me
POST   /api/auth/forgot-password | reset-password

GET    /api/products         ?page&limit&sort&material&stone&search&category&priceMin&priceMax
GET    /api/products/:id                    (id or slug)
GET    /api/products/:id/related

GET    /api/collections
GET    /api/collections/:slug

GET    /api/cart
POST   /api/cart/items
PATCH  /api/cart/items/:id
DELETE /api/cart/items/:id
DELETE /api/cart

POST   /api/checkout/shipping
POST   /api/checkout/create-payment-intent
POST   /api/checkout/confirm-order

GET    /api/orders
GET    /api/orders/:id

GET    /api/wishlist
POST   /api/wishlist/items
DELETE /api/wishlist/items/:productId

GET    /api/user/profile     PATCH /api/user/profile
GET    /api/user/addresses   POST/PATCH/DELETE …

POST   /api/stripe/webhook                  (raw body, signature-verified)

# admin (requires ADMIN role)
GET    /api/admin/stats
GET    /api/admin/orders     PATCH /api/admin/orders/:id
POST   /api/admin/products   PATCH/DELETE /api/admin/products/:id
POST   /api/admin/products/:id/image        (multipart → S3)
```

Seeded admin: `admin@aurum.luxury` / `admin12345`.

See `AURUM-Backend-Setup-Guide.md` and `AURUM-Third-Party-Integrations-Deployment.md`
(project root) for environment variables and deployment.
