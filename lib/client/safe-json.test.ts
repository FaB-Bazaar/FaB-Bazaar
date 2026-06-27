import { describe, it, expect } from 'vitest';
import { readApiResult } from './safe-json';

// Minimal Response-like stub.
const resp = (ok: boolean, status: number, body: string) => ({ ok, status, text: async () => body });

describe('readApiResult', () => {
  it('returns the parsed JSON body when the response is JSON', async () => {
    const r = await readApiResult(resp(true, 200, '{"success":true,"data":{"notes":"x"}}'));
    expect(r).toEqual({ success: true, data: { notes: 'x' } });
  });

  it('returns a friendly error (never throws) when the body is HTML — the deploy-lag/404 case', async () => {
    const r = await readApiResult(resp(false, 404, '<!DOCTYPE html><html>...</html>'));
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/404/); // surfaces the status, not "Unexpected token '<'"
  });

  it('handles an empty body without throwing', async () => {
    const r = await readApiResult(resp(false, 500, ''));
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/500/);
  });
});
