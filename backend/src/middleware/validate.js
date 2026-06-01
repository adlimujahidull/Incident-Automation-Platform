import { HttpError } from "../utils/http-error.js";

export function validate(schema, target = "body") {
  return function validateRequest(request, _response, next) {
    const result = schema.safeParse(request[target]);

    if (!result.success) {
      return next(
        new HttpError(
          400,
          "Validation failed",
          result.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          }))
        )
      );
    }

    request[target] = result.data;
    next();
  };
}

