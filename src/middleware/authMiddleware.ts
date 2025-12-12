import type { RequestHandler } from "express";
import { auth } from "../lib/auth";
import { headersFromExpress } from "../utils/http";
import { ApiError } from "./errorHandler";

export const attachAuthContext: RequestHandler = async (req, _res, next) => {
  try {
    if (req.path.startsWith("/auth")) return next();

    const session = await auth.api
      .getSession({ headers: headersFromExpress(req.headers) })
      .catch(() => null);

    if (session?.user) {
      req.user = session.user as Express.User;
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(new ApiError("Unauthorized", 401));
  next();
};
