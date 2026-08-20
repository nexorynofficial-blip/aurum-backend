import { stripe } from '../config/stripe';
import { ApiError } from '../utils/apiError';

function client() {
  if (!stripe) throw ApiError.serviceUnavailable('Payments are not configured');
  return stripe;
}

/** Create a Stripe PaymentIntent for an order. Amount is in major units (USD). */
export async function createPaymentIntent(orderId: string, amount: number) {
  const paymentIntent = await client().paymentIntents.create({
    amount: Math.round(amount * 100), // to cents
    currency: 'usd',
    metadata: { orderId },
    automatic_payment_methods: { enabled: true },
  });
  return {
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
  };
}

export async function retrievePaymentIntent(id: string) {
  return client().paymentIntents.retrieve(id);
}
