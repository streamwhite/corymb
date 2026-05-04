import { HEALTH_OK_BODY } from '@/constants/health.js';
import {
  AUTH_SIGNIN_PATH,
  AUTH_SIGNOUT_PATH,
  AUTH_SIGNUP_PATH,
  HEALTH_BASE_PATH,
  ITEMS_BASE_PATH,
  UI_AUTH_BASE_PATH,
} from '@/constants/routes.js';
import {
  handleAuthSignin,
  handleAuthSignout,
  handleAuthSignup,
} from '@/server/auth-route-handlers.js';
import {
  handleItemDelete,
  handleItemGet,
  handleItemPut,
  handleItemsCreate,
  handleItemsList,
} from '@/server/items-route-handlers.js';
import type { ItemStore } from '@/store/item-store.js';
import { buildAuthPageHtml } from '@/ui/auth-page-html.js';
import type { SQL } from 'bun';

const MIME_HTML_UTF8 = 'text/html; charset=utf-8' as const;

const ITEMS_ID_ROUTE = `${ITEMS_BASE_PATH}/:id` as const;

function itemIdFromRoute(req: Request): string {
  return (req as Request & { params: { id: string } }).params.id;
}

export type RouteBundle = {
  sql: SQL;
  store: ItemStore;
};

export function buildServeRoutes(
  bundle: RouteBundle,
): NonNullable<Serve['routes']> {
  const { sql, store } = bundle;
  return {
    [HEALTH_BASE_PATH]: { GET: () => Response.json(HEALTH_OK_BODY) },
    [UI_AUTH_BASE_PATH]: {
      GET: () =>
        new Response(buildAuthPageHtml(), {
          headers: { 'Content-Type': MIME_HTML_UTF8 },
        }),
    },
    [AUTH_SIGNUP_PATH]: {
      POST: (req: Request) => handleAuthSignup(req, sql),
    },
    [AUTH_SIGNIN_PATH]: {
      POST: (req: Request) => handleAuthSignin(req, sql),
    },
    [AUTH_SIGNOUT_PATH]: {
      POST: (req: Request) => handleAuthSignout(req, sql),
    },
    [ITEMS_BASE_PATH]: {
      GET: () => handleItemsList(store),
      POST: (req: Request) => handleItemsCreate(req, store),
    },
    [ITEMS_ID_ROUTE]: {
      GET: (req: Request) => handleItemGet(itemIdFromRoute(req), store),
      PUT: (req: Request) => handleItemPut(itemIdFromRoute(req), req, store),
      DELETE: (req: Request) => handleItemDelete(itemIdFromRoute(req), store),
    },
  };
}
