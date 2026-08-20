import { Request, Response } from 'express';
import type Stripe from 'stripe';
import { stripe } from '../config/stripe';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { toNumber } from '../utils/validators';
import {
  sendOrderConfirmationEmail,
  sendPaymentFailedEmail,
} from '../services/emailService';

/**
 * Stripe webhook. Mounted with express.raw so the signature can be verified
 * against the exact request body (see app.ts).
 */
export async function handleWebhook(req: Request, res: Response) {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).send('Stripe not configured');
  }

  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.warn('Stripe webhook signature verification failed:', (err as Error).message);
    return res.status(400).send(`Webhook Error: ${(err as Error).message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await onPaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await onPaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case 'charge.refunded':
        await onChargeRefunded(event.data.object as Stripe.Charge);
        break;
      default:
        logger.debug(`Unhandled Stripe event: ${event.type}`);
    }
  } catch (err) {
    logger.error('Error handling Stripe event:', (err as Error).message);
    // 200 anyway so Stripe doesn't retry indefinitely on our internal errors.
  }

  res.json({ received: true });
}

async function onPaymentSucceeded(pi: Stripe.PaymentIntent) {
  const order = await prisma.order.findUnique({
    where: { stripePaymentIntentId: pi.id },
    include: { lineItems: true, user: true },
  });
  if (!order || order.paidAt) return;

  await prisma.$transaction([
    prisma.order.update({ where: { id: order.id }, data: { paidAt: new Date() } }),
    ...order.lineItems.map((li) =>
      prisma.product.update({
        where: { id: li.productId },
        data: { stock: { decrement: li.quantity } },
      })
    ),
  ]);

  const to = order.user?.email ?? order.guestEmail;
  if (to) {
    await sendOrderConfirmationEmail({
      to,
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: toNumber(order.total),
    });
  }
  logger.info(`Order ${order.orderNumber} marked paid.`);
}

async function onPaymentFailed(pi: Stripe.PaymentIntent) {
  const order = await prisma.order.findUnique({
    where: { stripePaymentIntentId: pi.id },
    include: { user: true },
  });
  if (!order) return;
  const to = order.user?.email ?? order.guestEmail;
  if (to) await sendPaymentFailedEmail(to, order.orderNumber);
}

async function onChargeRefunded(charge: Stripe.Charge) {
  const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
  if (!piId) return;
  const order = await prisma.order.findUnique({ where: { stripePaymentIntentId: piId } });
  if (!order) return;
  await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
  logger.info(`Order ${order.orderNumber} cancelled (refunded).`);
}
