import { describe, expect, it } from "bun:test";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  isAppError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/errors/app-error.js";
import { toErrorResponse } from "@/errors/to-response.js";
import { HTTP_STATUS_INTERNAL } from "@/constants/http-status.js";
import { MSG_INTERNAL } from "@/constants/messages.js";

describe("AppError hierarchy", () => {
  it("carries status, code and exposure defaults", () => {
    const invalid = new ValidationError("bad input", { field: "email" });
    expect(invalid.status).toBe(400);
    expect(invalid.code).toBe("validation_error");
    expect(invalid.expose).toBe(true);
    expect(invalid.details).toEqual({ field: "email" });

    const internal = new AppError(500, "boom");
    expect(internal.code).toBe("internal_error");
    expect(internal.expose).toBe(false);
  });

  it("provides common subclasses", () => {
    expect(new UnauthorizedError().status).toBe(401);
    expect(new ForbiddenError().status).toBe(403);
    expect(new NotFoundError().status).toBe(404);
    expect(new ConflictError().status).toBe(409);
    expect(isAppError(new ForbiddenError())).toBe(true);
    expect(isAppError(new Error("x"))).toBe(false);
  });
});

describe("toErrorResponse", () => {
  it("maps AppError with code, details and request id", async () => {
    const res = toErrorResponse(new NotFoundError("no todo"), "req-1");
    expect(res.status).toBe(404);
    expect(res.headers.get("x-request-id")).toBe("req-1");
    expect(await res.json()).toEqual({
      error: "no todo",
      code: "not_found",
      requestId: "req-1",
    });
  });

  it("includes details for exposed client errors", async () => {
    const res = toErrorResponse(new ValidationError("bad", { field: "x" }));
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.details).toEqual({ field: "x" });
  });

  it("hides internals for unknown errors and 5xx", async () => {
    const unknown = toErrorResponse(new Error("secrets here"), "r");
    expect(unknown.status).toBe(HTTP_STATUS_INTERNAL);
    expect(await unknown.json()).toEqual({
      error: MSG_INTERNAL,
      code: "internal_error",
      requestId: "r",
    });

    const hidden = toErrorResponse(new AppError(500, "db password leaked"));
    expect(await hidden.json()).toMatchObject({ error: MSG_INTERNAL });
  });
});
