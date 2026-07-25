export interface AuthenticatedUser {
  id: string;
  _id?: unknown;
  role?: string;
  tenantId?: string;
  name?: string;
  email?: string;
}

declare global {
  namespace Express {
    export interface Request {
      user?: AuthenticatedUser;
      authStrategy?: string;
    }
  }
}

export {};
