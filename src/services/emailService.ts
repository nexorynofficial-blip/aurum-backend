import sgMail from '../config/sendgrid';
import { env, features } from '../config/env';
import { logger } from '../config/logger';

interface Mail {
  to: string;
  subject: string;
  html: string;
}

async function deliver({ to, subject, html }: Mail): Promise<void> {
  if (!features.sendgrid) {
    logger.info(`[email:dev] → ${to} | ${subject}`);
    return;
  }
  try {
    await sgMail.send({
      to,
      from: { email: env.SENDGRID_FROM_EMAIL, name: env.SENDGRID_FROM_NAME },
      subject,
      html,
    });
    logger.info(`Email sent → ${to} | ${subject}`);
  } catch (err) {
    logger.error('SendGrid error:', (err as Error).message);
    // Email delivery failures must not break the primary flow (e.g. an order).
  }
}

/** Generic helper used by auth flows. */
export async function sendEmail(to: string, subject: string, html: string) {
  return deliver({ to, subject, html });
}

export async function sendOrderConfirmationEmail(params: {
  to: string;
  orderNumber: string;
  total: number;
  estimatedDelivery?: string;
  orderId: string;
}) {
  const { to, orderNumber, total, estimatedDelivery, orderId } = params;
  return deliver({
    to,
    subject: `Your AURUM Order #${orderNumber}`,
    html: `
      <h1>Thank you for your order</h1>
      <p>Order Number: <strong>${orderNumber}</strong></p>
      <p>Total: $${total.toFixed(2)}</p>
      ${estimatedDelivery ? `<p>Estimated Delivery: ${estimatedDelivery}</p>` : ''}
      <p><a href="${env.FRONTEND_URL}/account/orders/${orderId}">View your order</a></p>
    `,
  });
}

export async function sendPaymentFailedEmail(to: string, orderNumber: string) {
  return deliver({
    to,
    subject: `Payment issue with your AURUM Order #${orderNumber}`,
    html: `
      <h1>We couldn't process your payment</h1>
      <p>Your order <strong>${orderNumber}</strong> could not be completed. Please try again.</p>
      <p><a href="${env.FRONTEND_URL}/cart">Return to your bag</a></p>
    `,
  });
}

export async function sendShippingUpdateEmail(to: string, orderNumber: string, trackingNumber: string) {
  return deliver({
    to,
    subject: `Your AURUM Order is on the Way #${orderNumber}`,
    html: `
      <h1>Your order has been dispatched</h1>
      <p>Tracking Number: <strong>${trackingNumber}</strong></p>
      <p><a href="https://www.fedex.com/fedextrack/?tracknumbers=${trackingNumber}">Track your package</a></p>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, resetToken: string) {
  const link = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  return deliver({
    to,
    subject: 'Reset Your AURUM Password',
    html: `
      <p>Click the link below to reset your password. This link expires in 1 hour.</p>
      <p><a href="${link}">Reset Password</a></p>
    `,
  });
}

export async function sendWelcomeEmail(to: string, firstName: string) {
  return deliver({
    to,
    subject: 'Welcome to AURUM',
    html: `<h1>Welcome, ${firstName}</h1><p>Your account is ready. Explore the collection whenever you're ready.</p>`,
  });
}
