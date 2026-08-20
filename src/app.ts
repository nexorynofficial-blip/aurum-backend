import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import morgan from 'morgan';
import { env, isDev } from './config/env';
import { globalRateLimiter } from './middleware/rateLimit';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { asyncHandler } from './utils/asyncHandler';
import { handleWebhook } from './controllers/stripeController';
import apiRoutes from './routes';

export const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
    credentials: true,
  })
);
app.use(compression());
app.use(cookieParser());
if (isDev) app.use(morgan('dev'));

// Stripe webhook needs the RAW body for signature verification — mount it
// BEFORE the JSON body parser.
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  asyncHandler(handleWebhook)
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', globalRateLimiter);

// Friendly root — the API is consumed by the storefront, not browsed directly.
app.get('/', (_req, res) => {
  res.json({
    service: 'AURUM API',
    status: 'ok',
    docs: 'The storefront runs on the frontend (http://localhost:3000).',
    endpoints: {
      health: '/api/health',
      products: '/api/products',
      collections: '/api/collections',
    },
  });
});

app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);
