import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

export interface RequestWithContext extends Request {
  requestId?: string;
}

export function requestContextMiddleware(
  request: RequestWithContext,
  response: Response,
  next: NextFunction,
) {
  const suppliedRequestId = request.header('x-request-id');
  const requestId =
    suppliedRequestId && /^[A-Za-z0-9._-]{8,128}$/.test(suppliedRequestId)
      ? suppliedRequestId
      : randomUUID();
  request.requestId = requestId;
  response.setHeader('x-request-id', requestId);
  next();
}
