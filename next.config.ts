import type { NextConfig } from "next";

import type { NextConfig } from "next";
import { securityHeaders } from "./lib/security/csp";

/**
 * Security headers are applied to every route from one place rather than per
 * layout, so a new route cannot ship without them.
 *
 * `lib/security/csp.ts` owns the policy and the reasoning behind each
 * directive; this file only wires the environment into it.
 *
 * Note that `process.env.NODE_ENV` is inlined by Next at build time, and every
 * `NEXT_PUBLIC_*` value is inlined into the client bundle. The RPC origin in
 * the policy is therefore a build-time decision: changing
 * `NEXT_PUBLIC_SOROBAN_RPC_URL` requires a redeploy for the header to change
 * with it.
 */

/**
 * `/_next/static/**` is Next.js build output and every file under it is
 * content-hashed (e.g. `/_next/static/chunks/00k5.dx24ut2p.js`,
 * `/_next/static/media/02263ebad….woff2`). Changing the bytes of a file always
 * changes its name, so a given URL can never resolve to two different payloads
 * across two builds. That is what makes a one-year `immutable` lifetime safe
 * here: the cache key *is* the content address.
 */
export const STATIC_ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable";

/**
 * Everything else — the prerendered HTML shell and the unversioned files in
 * `public/` — is mutable and must never be served stale.
 *
 * The load-bearing parts of this value are `max-age=0` and `must-revalidate`. A
 * shared cache is still allowed to *store* the response, so a repeat visit is a
 * cheap conditional request rather than a fresh origin round trip, but the entry
 * is stale the moment it is stored and cannot be reused without asking the
 * origin. That is precisely what stops an edge cache from masking a deploy: with
 * an aggressive `s-maxage` on `/` — which is what `next start` emits for the
 * prerendered shell before this config exists — a CDN can keep handing out an
 * old build's HTML for a year, and that HTML points at `/_next/static/**` hashes
 * the new build does not have, so the app breaks with chunk 404s instead of
 * silently going stale. `stale-while-revalidate` is deliberately NOT used here.
 */
export const REVALIDATE_CACHE_CONTROL = "public, max-age=0, must-revalidate";

/** The source pattern that matches Next.js build output. */
export const STATIC_ASSET_SOURCE = "/_next/static/:path*";

/** The catch-all source pattern: every path, including the HTML shell. */
export const ALL_PATHS_SOURCE = "/:path*";

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  async headers() {
    const headers = securityHeaders({
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_SOROBAN_RPC_URL: process.env.NEXT_PUBLIC_SOROBAN_RPC_URL,
      NEXT_PUBLIC_CSP_CONNECT_SRC: process.env.NEXT_PUBLIC_CSP_CONNECT_SRC,
      NEXT_PUBLIC_CSP_ALLOW_ANY_HTTPS: process.env.NEXT_PUBLIC_CSP_ALLOW_ANY_HTTPS,
    });

    return [
      // ORDER MATTERS — read before editing.
      //
      // Next runs *every* matching rule and the **last** match wins
      // (`resHeaders[key] = value` in
      // `next/dist/server/lib/router-utils/resolve-routes.js`). The catch-all
      // `/:path*` also matches `/_next/static/**`, so the immutable rule has to be
      // listed after it, otherwise the catch-all would clobber it and every chunk
      // would be revalidated on each visit.
      {
        // Covers every page and every asset, including routes added later.
        source: ALL_PATHS_SOURCE,
        headers: [
          ...headers.map(({ key, value }) => ({ key, value })),
          // HTML shell + unversioned `public/` files: always revalidate.
          { key: "Cache-Control", value: REVALIDATE_CACHE_CONTROL },
        ],
      },
      {
        // Content-hashed build output: cache forever.
        source: STATIC_ASSET_SOURCE,
        headers: [{ key: "Cache-Control", value: STATIC_ASSET_CACHE_CONTROL }],
      },
    ];
  },
};

export default nextConfig;
