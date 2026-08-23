import { PrismaClient, Prisma, OrderStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const customers = [
  { firstName: 'Eleanor', lastName: 'Hargrove', email: 'eleanor.hargrove@example.com', city: 'London', country: 'United Kingdom', state: 'England', zip: 'W1K 5AB' },
  { firstName: 'Julian', lastName: 'Voss', email: 'julian.voss@example.com', city: 'Zurich', country: 'Switzerland', state: 'ZH', zip: '8001' },
  { firstName: 'Camille', lastName: 'Dubois', email: 'camille.dubois@example.com', city: 'Paris', country: 'France', state: 'IDF', zip: '75008' },
  { firstName: 'Nathaniel', lastName: 'Reyes', email: 'nathaniel.reyes@example.com', city: 'New York', country: 'United States', state: 'NY', zip: '10021' },
  { firstName: 'Isabella', lastName: 'Moreau', email: 'isabella.moreau@example.com', city: 'Milan', country: 'Italy', state: 'MI', zip: '20121' },
  { firstName: 'Theodore', lastName: 'Whitfield', email: 'theodore.whitfield@example.com', city: 'Edinburgh', country: 'United Kingdom', state: 'Scotland', zip: 'EH2 2AN' },
  { firstName: 'Anastasia', lastName: 'Kovalenko', email: 'anastasia.kovalenko@example.com', city: 'Vienna', country: 'Austria', state: 'Vienna', zip: '1010' },
  { firstName: 'Marcus', lastName: 'Lindqvist', email: 'marcus.lindqvist@example.com', city: 'Stockholm', country: 'Sweden', state: 'Stockholm', zip: '111 29' },
  { firstName: 'Seraphina', lastName: 'Castellano', email: 'seraphina.castellano@example.com', city: 'Rome', country: 'Italy', state: 'RM', zip: '00187' },
  { firstName: 'Oliver', lastName: 'Bennett', email: 'oliver.bennett@example.com', city: 'Singapore', country: 'Singapore', state: '', zip: '238859' },
  { firstName: 'Genevieve', lastName: 'Laurent', email: 'genevieve.laurent@example.com', city: 'Geneva', country: 'Switzerland', state: 'GE', zip: '1204' },
  { firstName: 'Alexander', lastName: 'Petrov', email: 'alexander.petrov@example.com', city: 'Dubai', country: 'United Arab Emirates', state: '', zip: '00000' },
];

const statusPool: { status: OrderStatus; weight: number }[] = [
  { status: 'DELIVERED', weight: 5 },
  { status: 'DISPATCHED', weight: 2 },
  { status: 'PENDING', weight: 2 },
  { status: 'RETURNED', weight: 1 },
  { status: 'CANCELLED', weight: 1 },
];

function pickStatus(): OrderStatus {
  const total = statusPool.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of statusPool) {
    if (r < p.weight) return p.status;
    r -= p.weight;
  }
  return 'DELIVERED';
}

function randomDateInLastMonths(months: number): Date {
  const now = Date.now();
  const past = now - months * 30 * 24 * 60 * 60 * 1000;
  return new Date(past + Math.random() * (now - past));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log('Seeding AURUM mock demo data (customers + orders)…');

  const shippingMethods = await prisma.shippingMethod.findMany();
  const standard = shippingMethods.find((s) => s.code === 'standard')!;
  const express = shippingMethods.find((s) => s.code === 'express')!;

  const products = await prisma.product.findMany();
  if (products.length === 0) {
    throw new Error('No products found — run `npm run seed` first.');
  }

  const customerPassword = await bcrypt.hash('customer12345', 12);
  const userIds: string[] = [];

  for (const c of customers) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      create: {
        email: c.email,
        passwordHash: customerPassword,
        firstName: c.firstName,
        lastName: c.lastName,
        role: 'CUSTOMER',
        emailVerified: true,
        createdAt: randomDateInLastMonths(11),
      },
      update: {},
    });
    userIds.push(user.id);
  }

  console.log(`Seeded ${customers.length} customers.`);

  const existingOrders = await prisma.order.count();
  const ORDER_COUNT = 42;
  let created = 0;

  for (let i = 0; i < ORDER_COUNT; i++) {
    const orderNumber = `AU-${10000 + existingOrders + i}`;
    const exists = await prisma.order.findUnique({ where: { orderNumber } });
    if (exists) continue;

    const userId = pick(userIds);
    const user = customers[userIds.indexOf(userId)];
    const shippingMethod = Math.random() < 0.7 ? standard : express;
    const status = pickStatus();
    const createdAt = randomDateInLastMonths(11);

    const itemCount = 1 + Math.floor(Math.random() * 3);
    const chosenProducts = [...products].sort(() => Math.random() - 0.5).slice(0, itemCount);

    let subtotal = 0;
    const lineItems = chosenProducts.map((p) => {
      const quantity = 1 + (Math.random() < 0.15 ? 1 : 0);
      const price = Number(p.price);
      subtotal += price * quantity;
      return {
        productId: p.id,
        productName: p.name,
        image: p.images[0] ?? null,
        quantity,
        priceAtPurchase: new Prisma.Decimal(price),
      };
    });

    const taxAmount = Math.round(subtotal * 0.08 * 100) / 100;
    const shippingCost = Number(shippingMethod.baseCost);
    const total = Math.round((subtotal + taxAmount + shippingCost) * 100) / 100;

    const isPaid = status !== 'PENDING' && status !== 'CANCELLED' ? true : Math.random() < 0.3;
    const dispatchedAt = ['DISPATCHED', 'DELIVERED', 'RETURNED'].includes(status)
      ? new Date(createdAt.getTime() + 1000 * 60 * 60 * 24)
      : null;
    const deliveredAt = ['DELIVERED', 'RETURNED'].includes(status)
      ? new Date(createdAt.getTime() + 1000 * 60 * 60 * 24 * 4)
      : null;

    await prisma.order.create({
      data: {
        orderNumber,
        userId,
        status,
        subtotal: new Prisma.Decimal(Math.round(subtotal * 100) / 100),
        taxAmount: new Prisma.Decimal(taxAmount),
        shippingCost: new Prisma.Decimal(shippingCost),
        total: new Prisma.Decimal(total),
        shippingAddress: {
          firstName: user.firstName,
          lastName: user.lastName,
          street: '1 Mock Address Ave',
          city: user.city,
          state: user.state,
          zipCode: user.zip,
          country: user.country,
        },
        stripePaymentIntentId: `pi_mock_${orderNumber}`,
        paidAt: isPaid ? createdAt : null,
        dispatchedAt,
        deliveredAt,
        trackingNumber: dispatchedAt ? `TRK-${Math.floor(Math.random() * 900000 + 100000)}` : null,
        createdAt,
        shippingMethodId: shippingMethod.id,
        lineItems: { create: lineItems },
      },
    });
    created++;
  }

  console.log(`Seeded ${created} orders.`);
  console.log('Mock demo data ready.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
