import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the service layer BEFORE importing the module under test (vi.mock is hoisted)
vi.mock('@/lib/services', () => ({
  userService: { findByDiscordId: vi.fn() },
  binderService: { getUserBindersWithStats: vi.fn() },
}));

import { handleAddToBinder, addPrintingToBinder } from './cardActions.js';
import { userService, binderService } from '@/lib/services';

const mockFindByDiscordId = vi.mocked(userService.findByDiscordId);
const mockGetBinders = vi.mocked(binderService.getUserBindersWithStats);

describe('handleAddToBinder — binder dropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the binder _id as the select-menu option value, not the slug', async () => {
    mockFindByDiscordId.mockResolvedValue({
      success: true,
      data: { _id: 'user-1', username: 'rob' },
    });
    mockGetBinders.mockResolvedValue({
      success: true,
      data: [
        {
          _id: 'binder-id-abc123',
          name: 'addcardsfromdeck',
          slug: 'addcardsfromdeck',
          archived: false,
        },
      ],
    });

    const body = { member: { user: { id: 'discord-123' } } };
    const response = await handleAddToBinder(body, 'card-unique-1', 'Evo Beta Base Head');
    const json = await response.json();

    const options = json.data.components[0].components[0].options;
    expect(options).toHaveLength(1);
    // The web route /api/binders/[binderId]/cards is ID-only; the dropdown must
    // carry the binder ID so the downstream add call doesn't 404 on a slug.
    expect(options[0].value).toBe('binder-id-abc123');
  });
});

describe('addPrintingToBinder', () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'https://fabbazaar.app';
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('POSTs to the ID-based binder cards route', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, summary: { added: 1 } }),
    });

    await addPrintingToBinder('discord-123', 'binder-id-abc123', 'printing-1', 'Evo Beta Base Head');

    const calledUrl = (global.fetch as any).mock.calls[0][0];
    expect(calledUrl).toBe('https://fabbazaar.app/api/binders/binder-id-abc123/cards');
  });

  it('does not leak the raw binder ID into the success message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, summary: { added: 1 } }),
    });

    const response = await addPrintingToBinder(
      'discord-123',
      'binder-id-abc123',
      'printing-1',
      'Evo Beta Base Head'
    );
    const json = await response.json();

    expect(json.data.content).toContain('Evo Beta Base Head');
    expect(json.data.content).not.toContain('binder-id-abc123');
  });
});
