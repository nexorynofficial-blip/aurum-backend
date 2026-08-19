import Stripe from 'stripe';
import { env, features } from './env';
import { logger } from './logger';

/**
 * Stripe client. Only instantiated when a secret key is configured so the
 * server can run locally without payment credentials (payment routes will
 * return 503 in that case — see paymentService).
 */
export const stripe: Stripe | null = features.stripe
  ? new Stripe(env.STRIPE_SECRET_KEY as string, {
      // Pin to the SDK's bundled API version; override via dashboard if needed.
      apiVersion: '2024-04-10' as Stripe.LatestApiVersion,
    })
  : null;

if (!features.stripe) {
  logger.warn('Stripe not configured — payment endpoints are disabled.');
}
