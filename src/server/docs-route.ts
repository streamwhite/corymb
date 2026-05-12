import {
  DOCS_ACCESS_MODE_DEVELOPMENT,
  DOCS_ACCESS_MODE_PRODUCTION,
  type DocsAccessMode,
} from "@/constants/docs-access.js";
import { isNodeEnvDevelopment } from "@/runtime/node-env.js";

export function isDocsRouteAllowed(mode: DocsAccessMode): boolean {
  if (mode === DOCS_ACCESS_MODE_DEVELOPMENT) {
    return true;
  }
  if (mode === DOCS_ACCESS_MODE_PRODUCTION) {
    return false;
  }
  return isNodeEnvDevelopment();
}
