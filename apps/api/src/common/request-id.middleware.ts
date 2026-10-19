import { randomUUID } from "node:crypto";
import { API_HEADERS } from "@kivora/shared";
import type { NextFunction, Request, Response } from "express";

const VALID_REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** Atribui um identificador a cada pedido. Aceita o do cliente só se for seguro. */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(API_HEADERS.REQUEST_ID);
  const requestId = incoming !== undefined && VALID_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.locals["requestId"] = requestId;
  res.setHeader(API_HEADERS.REQUEST_ID, requestId);
  next();
}
