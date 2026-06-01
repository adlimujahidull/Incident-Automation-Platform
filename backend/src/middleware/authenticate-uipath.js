import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";

export function authenticateUiPath(request, _response, next) {
  if (!env.uipathSharedSecret) {
    return next(new HttpError(503, "UiPath shared secret is not configured"));
  }

  const providedSecret = String(request.headers["x-uipath-key"] ?? "").trim();

  if (!providedSecret) {
    return next(new HttpError(401, "UiPath shared secret is required"));
  }

  if (providedSecret !== env.uipathSharedSecret) {
    return next(new HttpError(401, "UiPath shared secret is invalid"));
  }

  request.uipath = {
    source: "UIPATH",
    authenticated: true
  };

  next();
}
