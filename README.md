# E-commerce Loyalty Service

## Achievements & Badges

An event-driven service that listens for completed orders and awards **achievements** and **badges**, unlocking **cashback** rewards.

---

## How it works

One HTTP request is used to mock an order completed and emits the event. Each stage does its own work, then publishes the next event.

## Reward catalogue

Config in `src/consts/rewards.ts`, `prisma/seed.ts` writes these rows to the DB

## Running it

### Docker (everything)

```bash
cp .env.example .env      # fill in secrets
docker compose up -d
```

The entrypoint runs `prisma generate`, `migrate deploy` and the seed before starting the server.

`docker compose down` stops the stack and keeps the data; add `-v` to discard it.

### Local

Needs Postgres and RabbitMQ already running.

```bash
npm install
npm run generate     # prisma generate
npm run migrate      # prisma migrate dev
npm run seed         # reward catalogue
npm run dev
```

## Tests

```bash
npm test
```
