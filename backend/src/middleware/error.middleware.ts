import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  status?: string;
}

// Prisma error codes that should not leak schema details to clients
const PRISMA_ERROR_CODES = new Set(['P2002', 'P2003', 'P2025', 'P2016']);

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const status = err.status || 'error';
  const isProd = process.env.NODE_ENV === 'production';

  // FIX: sanitize Prisma errors in production — they leak table/column names
  const isPrismaError = 'code' in err && typeof (err as Record<string, unknown>).code === 'string'
    && PRISMA_ERROR_CODES.has((err as Record<string, unknown>).code as string);

  const message = isProd && (statusCode === 500 || isPrismaError)
    ? 'Internal Server Error'
    : err.message || 'Internal Server Error';

  res.status(statusCode).json({
    status,
    message,
    ...((!isProd) && { stack: err.stack }),
  });
};

export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const err: AppError = new Error(`Not Found - ${req.originalUrl}`);
  err.statusCode = 404;
  next(err);
};
