import 'express';

declare global {
  namespace Express {
    interface AuthUser {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
    }
    interface Request {
      /** Populated by the auth middleware when a valid token is present. */
      user?: AuthUser;
      /** Anonymous cart identifier (cookie-based) for guests. */
      cartId?: string;
    }
  }
}

export {};
