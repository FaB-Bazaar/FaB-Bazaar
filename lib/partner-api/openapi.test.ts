import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { buildOpenApiSpec } from './openapi';
import { PARTNER_SCOPES } from './scopes';

const ROOT = join(process.cwd(), 'app/api/partner/v1');
const spec = buildOpenApiSpec('https://example.test') as any;

/** Every `export const METHOD = partnerRoute('scope', …)` under app/api/partner/v1. */
function operationsOnDisk() {
  const found: Array<{ path: string; method: string; scope: string }> = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (!name.startsWith('_')) walk(full);
        continue;
      }
      if (name !== 'route.ts') continue;
      const source = readFileSync(full, 'utf8');
      const path =
        '/' +
        relative(ROOT, dir)
          .split(sep)
          .map(part => part.replace(/^\[(.+)\]$/, '{$1}'))
          .join('/');
      for (const m of source.matchAll(/export const (GET|POST|PUT|PATCH|DELETE) = partnerRoute(?:<[^>]*>)?\(\s*'([^']+)'/g)) {
        found.push({ path, method: m[1].toLowerCase(), scope: m[2] });
      }
    }
  };
  walk(ROOT);
  return found;
}

function refs(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) node.forEach(n => refs(n, out));
  else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref' && typeof value === 'string') out.push(value);
      else refs(value, out);
    }
  }
  return out;
}

describe('partner API OpenAPI spec', () => {
  const onDisk = operationsOnDisk();

  it('finds the routes it is checking', () => {
    expect(onDisk.length).toBeGreaterThanOrEqual(11);
  });

  it('describes every route that exists, with the scope the route enforces', () => {
    for (const op of onDisk) {
      const described = spec.paths[op.path]?.[op.method];
      expect(described, `${op.method.toUpperCase()} ${op.path} is missing from the spec`).toBeDefined();
      expect(described.security, `${op.method.toUpperCase()} ${op.path}`).toEqual([{ oauth2: [op.scope] }]);
    }
  });

  it('describes no route that does not exist', () => {
    const described = Object.entries(spec.paths).flatMap(([path, methods]) =>
      Object.keys(methods as object).map(method => `${method} ${path}`),
    );
    expect(described.sort()).toEqual(onDisk.map(op => `${op.method} ${op.path}`).sort());
  });

  it('declares the OAuth flow and every partner scope against the given base URL', () => {
    const flow = spec.components.securitySchemes.oauth2.flows.authorizationCode;
    expect(flow.authorizationUrl).toBe('https://example.test/oauth/authorize');
    expect(flow.tokenUrl).toBe('https://example.test/oauth/token');
    expect(Object.keys(flow.scopes).sort()).toEqual([...PARTNER_SCOPES].sort());
    expect(spec.servers).toEqual([{ url: 'https://example.test/api/partner/v1' }]);
    expect(spec.openapi).toMatch(/^3\.1\./);
  });

  it('gives every operation an id, a summary and the auth error responses', () => {
    const ids = new Set<string>();
    for (const methods of Object.values(spec.paths) as any[]) {
      for (const op of Object.values(methods) as any[]) {
        expect(op.operationId).toBeTruthy();
        expect(ids.has(op.operationId)).toBe(false);
        ids.add(op.operationId);
        expect(op.summary).toBeTruthy();
        expect(Object.keys(op.responses)).toEqual(expect.arrayContaining(['401', '403']));
      }
    }
  });

  it('has no dangling references', () => {
    for (const ref of refs(spec)) {
      const target = ref
        .replace(/^#\//, '')
        .split('/')
        .reduce((node: any, key) => node?.[key], spec);
      expect(target, ref).toBeDefined();
    }
  });
});
