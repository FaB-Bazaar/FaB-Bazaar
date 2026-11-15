import { describe, it, expect } from 'vitest';
import { describeProfileLoadError } from './profile-load-error';

describe('describeProfileLoadError', () => {
  it('says the profile was not found only for a 404', () => {
    const e = describeProfileLoadError(404, 'someone');
    expect(e.title).toBe('Profile Not Found');
    expect(e.message).toContain('someone');
  });

  it('tells a rate-limited visitor to wait instead of claiming the user is missing', () => {
    const e = describeProfileLoadError(429, 'someone');
    expect(e.title).not.toBe('Profile Not Found');
    expect(e.message).toMatch(/minute/i);
  });

  it('treats a server error as a loading problem', () => {
    expect(describeProfileLoadError(500, 'someone').title).toBe("Couldn't Load Profile");
  });

  it('treats a network failure (no status) as a loading problem', () => {
    expect(describeProfileLoadError(null, 'someone').title).toBe("Couldn't Load Profile");
  });
});
