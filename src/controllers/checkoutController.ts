import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { ApiError } from '../utils/apiError';
import { toNumber } from '../utils/validators';
import { computeTotals } from '../utils/pricing';
import { generateOrderNumber } from '../utils/orderNumber';
import { v4 as uuid } from 'uuid';
import { createPaymentIntent, retrievePaymentIntent } from '../services/paymentService';
import { stripe } from '../config/stripe';
import { sendOrderConfirmationEmail } from '../services/emailService';
import * as cartService from '../services/cartService';

const addressSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  street: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  zipCode: z.string().min(1),
  country: z.string().min(1),
  phone: z.string().optional(),
});

/** Load and validate the caller's cart lines with live product prices. */
async function loadPricedLines(req: Request) {
  const stored = await cartService.getStoredLines(req);
  if (stored.length === 0) throw ApiError.badRequest('Your cart is empty');

  const products = await prisma.product.findMany({
    where: { id: { in: stored.map((l) => l.productId) } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines = stored.map((l) => {
    const p = byId.get(l.productId);
    if (!p) throw ApiError.badRequest('A product in your cart is no longer available');
    return { product: p, quantity: l.quantity, variant: l.variant, price: toNumber(p.price) };
  });
  return lines;
}

export async function getShippingOptions(req: Request, res: Response) {
  const lines = await loadPricedLines(req);
  const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const methods = await prisma.shippingMethod.findMany({ orderBy: { baseCost: 'asc' } });

  res.json({
    shippingMethods: methods.map((m) => ({
      id: m.id,
      name: m.name,
      cost: toNumber(m.baseCost),
      estimatedDays: m.estimatedDays,
    })),
    estimatedTax: Math.round(subtotal * env.TAX_RATE * 100) / 100,
    subtotal: Math.round(subtotal * 100) / 100,
  });
}

const intentSchema = z.object({
  shippingMethodId: z.string().min(1),
  shippingAddress: addressSchema,
  billingAddress: addressSchema.optional(),
  billingAddressSameAsShipping: z.boolean().optional(),
  notes: z.string().optional(),
  email: z.string().email().optional(),
});

export async function createIntent(req: Request, res: Response) {
  if (!stripe) throw ApiError.serviceUnavailable('Payments are not configured');

  const body = intentSchema.parse(req.body);
  const email = req.user?.email ?? body.email;
  if (!email) throw ApiError.badRequest('An email is required for guest checkout');

  const lines = await loadPricedLines(req);
  const method = await prisma.shippingMethod.findFirst({ where: { OR: [{ id: body.shippingMethodId }, { code: body.shippingMethodId }] } });
  if (!method) throw ApiError.badRequest('Invalid shipping method');

  const totals = computeTotals(
    lines.map((l) => ({ price: l.price, quantity: l.quantity })),
    toNumber(method.baseCost)
  );

  // 1. Create the Stripe PaymentIntent
  const intent = await createPaymentIntent('pending', totals.total);

  // 2. Persist the order (PENDING) with the payment-intent id
  const orderNumber = await generateOrderNumber();
  const order = await prisma.order.create({
    data: {
      orderNumber,
      userId: req.user?.id ?? null,
      guestEmail: req.user ? null : email,
      guestFirstName: req.user ? null : body.shippingAddress.firstName,
      guestLastName: req.user ? null : body.shippingAddress.lastName,
      status: 'PENDING',
      subtotal: totals.subtotal,
      taxAmount: totals.tax,
      shippingCost: totals.shipping,
      total: totals.total,
      shippingAddress: body.shippingAddress,
      billingAddress: body.billingAddressSameAsShipping ? body.shippingAddress : body.billingAddress ?? undefined,
      notes: body.notes,
      stripePaymentIntentId: intent.paymentIntentId,
      shippingMethodId: method.id,
      lineItems: {
        create: lines.map((l) => ({
          productId: l.product.id,
          productName: l.product.name,
          image: l.product.images[0] ?? null,
          quantity: l.quantity,
          priceAtPurchase: l.price,
          variant: l.variant ?? undefined,
        })),
      },
    },
  });

  // 3. Attach the order id to the PaymentIntent for webhook reconciliation
  await stripe.paymentIntents.update(intent.paymentIntentId, {
    metadata: { orderId: order.id, orderNumber },
  });

  res.json({
    paymentIntentId: intent.paymentIntentId,
    clientSecret: intent.clientSecret,
    amount: intent.amount,
    currency: intent.currency,
    orderNumber,
  });
}

/**
 * Simulated checkout — creates a paid order without Stripe. Used when payment
 * keys are not configured (demo mode). Decrements stock, clears the cart, and
 * emails a confirmation (a no-op when SendGrid is absent).
 */
export async function placeOrder(req: Request, res: Response) {
  const body = intentSchema.parse(req.body);
  const email = req.user?.email ?? body.email;
  if (!email) throw ApiError.badRequest('An email is required for guest checkout');

  const lines = await loadPricedLines(req);
  const method = await prisma.shippingMethod.findFirst({ where: { OR: [{ id: body.shippingMethodId }, { code: body.shippingMethodId }] } });
  if (!method) throw ApiError.badRequest('Invalid shipping method');

  const totals = computeTotals(
    lines.map((l) => ({ price: l.price, quantity: l.quantity })),
    toNumber(method.baseCost)
  );

  const orderNumber = await generateOrderNumber();
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber,
        userId: req.user?.id ?? null,
        guestEmail: req.user ? null : email,
        guestFirstName: req.user ? null : body.shippingAddress.firstName,
        guestLastName: req.user ? null : body.shippingAddress.lastName,
        status: 'PENDING',
        subtotal: totals.subtotal,
        taxAmount: totals.tax,
        shippingCost: totals.shipping,
        total: totals.total,
        shippingAddress: body.shippingAddress,
        billingAddress: body.billingAddressSameAsShipping ? body.shippingAddress : body.billingAddress ?? undefined,
        notes: body.notes,
        stripePaymentIntentId: `sim_${uuid()}`,
        paidAt: new Date(),
        shippingMethodId: method.id,
        lineItems: {
          create: lines.map((l) => ({
            productId: l.product.id,
            productName: l.product.name,
            image: l.product.images[0] ?? null,
            quantity: l.quantity,
            priceAtPurchase: l.price,
            variant: l.variant ?? undefined,
          })),
        },
      },
    });
    for (const l of lines) {
      await tx.product.update({ where: { id: l.product.id }, data: { stock: { decrement: l.quantity } } });
    }
    return created;
  });

  await sendOrderConfirmationEmail({
    to: email,
    orderId: order.id,
    orderNumber,
    total: totals.total,
  });
  await cartService.clearCart(req);

  const eta = new Date();
  eta.setDate(eta.getDate() + method.estimatedDays);

  res.status(201).json({
    order: {
      id: order.id,
      orderNumber,
      status: 'pending',
      total: totals.total,
      createdAt: order.createdAt,
      estimatedDelivery: eta.toISOString().slice(0, 10),
    },
  });
}

const confirmSchema = z.object({ paymentIntentId: z.string().min(1) });

export async function confirmOrder(req: Request, res: Response) {
  const { paymentIntentId } = confirmSchema.parse(req.body);

  const order = await prisma.order.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
    include: { shippingMethod: true },
  });
  if (!order) throw ApiError.notFound('Order not found');

  // Best-effort payment status check (webhook remains source of truth).
  if (stripe) {
    const pi = await retrievePaymentIntent(paymentIntentId);
    if (pi.status !== 'succeeded' && pi.status !== 'processing') {
      throw ApiError.badRequest(`Payment not completed (status: ${pi.status})`);
    }
  }

  await cartService.clearCart(req);

  const eta = new Date();
  eta.setDate(eta.getDate() + order.shippingMethod.estimatedDays);

  res.status(201).json({
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: toNumber(order.total),
      createdAt: order.createdAt,
      estimatedDelivery: eta.toISOString().slice(0, 10),
    },
  });
}
