import sgMail from '@sendgrid/mail';
import { env, features } from './env';
import { logger } from './logger';

if (features.sendgrid) {
  sgMail.setApiKey(env.SENDGRID_API_KEY as string);
} else {
  logger.warn('SendGrid not configured — emails will be logged, not sent.');
}

export default sgMail;
