import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guards the single source of truth for the toolchain versions.
 *
 * The Node version appears in three places by necessity: `.nvmrc` (native local
 * setup and CI), and the `FROM` line in `Dockerfile.dev`. When they disagree the
 * container silently stops reproducing CI, which is the exact failure this
 * repository has already been bitten by twice: the lockfile was regenerated to
 * match one npm version, and jsdom was downgraded for a different Node.
 *
 * These tests are cheap and turn that class of drift into a failing check rather
 * than a confusing bug report weeks later.
 */

// The test lives in scripts/, so the repository root is one level up.
const root = join(__dirname, "..");

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("toolchain version consistency", () => {
  it(".nvmrc pins a concrete Node major version", () => {
    const version = read(".nvmrc").trim();

    // A bare major is intentional: `node-version-file` accepts it, and it avoids
    // pinning a patch that ages badly.
    expect(version).toMatch(/^\d+$/);
    expect(Number(version)).toBeGreaterThanOrEqual(20);
  });

  it("Dockerfile.dev uses the same Node major as .nvmrc", () => {
    const nvmrc = read(".nvmrc").trim();
    const dockerfile = read("Dockerfile.dev");

    // Match the major from `node:<version>` so the tag can carry a suffix.
    const match = dockerfile.match(/^FROM node:(\d+)/m);
    expect(match, "Dockerfile.dev should build FROM node:<version>").not.toBeNull();
    expect(match![1]).toBe(nvmrc);
  });

  it("Dockerfile.dev pins npm rather than inheriting a drifting version", () => {
    const dockerfile = read("Dockerfile.dev");

    // The `node:20` tag ships whatever npm was current at image build time.
    expect(dockerfile).toMatch(/ARG NPM_VERSION=\d+\.\d+\.\d+/);
    expect(dockerfile).toMatch(/npm install --global "npm@\$\{NPM_VERSION\}"/);
  });

  it("CI reads the Node version from .nvmrc instead of hardcoding it", () => {
    const ci = read(".github/workflows/ci.yml");

    // A hardcoded `node-version:` here is exactly how the three drift apart.
    expect(ci).toContain("node-version-file: .nvmrc");
    expect(ci).not.toMatch(/node-version:\s*\d/);
  });

  it("excludes node_modules from the build context", () => {
    // Otherwise a host-side node_modules is copied in, which breaks the
    // dependency layer cache and can pull in native modules built for the host.
    const dockerignore = read(".dockerignore");

    expect(dockerignore).toMatch(/^node_modules$/m);
    expect(dockerignore).toMatch(/^\.next$/m);
    // Every variable in .env* is NEXT_PUBLIC_* and ends up in the bundle.
    expect(dockerignore).toMatch(/^\.env\*$/m);
  });

  it("both compose and the dev image are tracked", () => {
    // Cheap guard against the files being deleted while the README still points
    // at them.
    expect(read("docker-compose.yml")).toContain("Dockerfile.dev");
    // The image's default command is `npm run dev`, in exec form.
    expect(read("Dockerfile.dev")).toContain('CMD ["npm", "run", "dev"]');
  });
});
