import type { Middleware } from "@/middleware/middleware-types.js";

export type MiddlewareRegistry = {
  /** Registers a named middleware; later same-name registrations overwrite. */
  use: (name: string, middleware: Middleware) => void;
  get: (name: string) => Middleware | undefined;
  /** Returns registered middleware in registration order. */
  all: () => Middleware[];
  /** Returns middleware for the given names, throwing on unknown names. */
  pick: (names: string[]) => Middleware[];
};

/** Simple named middleware registry for assembling per-route chains. */
export function createMiddlewareRegistry(): MiddlewareRegistry {
  const entries = new Map<string, Middleware>();
  return {
    use(name, middleware) {
      entries.set(name, middleware);
    },
    get(name) {
      return entries.get(name);
    },
    all() {
      return [...entries.values()];
    },
    pick(names) {
      return names.map((name) => {
        const middleware = entries.get(name);
        if (middleware === undefined) {
          throw new Error(`Unknown middleware: ${name}`);
        }
        return middleware;
      });
    },
  };
}
