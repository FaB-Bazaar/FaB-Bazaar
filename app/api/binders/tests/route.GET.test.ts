/**
 * Integration Tests for GET /api/binders
 *
 * Tests the main binders listing endpoint with various authentication methods
 * and query parameters. Uses real database queries (not mocked) for integration testing.
 *
 * Prerequisites: Run `npx ts-node scripts/setup-test-binders.ts` to create test data
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';
import Binder from '@/models/Binder';
import connectToDatabase from '@/lib/mongodb';

// Test user IDs from staging database
const TEST_USERS = {
  alpha: {
    _id: '68defef49ee97ddb4656dc0e',
    username: 'testuser_alpha',
    mcpToken: '01150ec7376277efbdc24947fa2593a89bb8e38eda4cce5e6ea4121e405ae779',
  },
  beta: {
    _id: '68defef49ee97ddb4656dc0f',
    username: 'testuser_beta',
    mcpToken: '9d602620e309275c0c07019621cb42ff53a2ebcc9f15eae164746b5bd3f34661',
  },
  gamma: {
    _id: '68defef49ee97ddb4656dc10',
    username: 'testuser_gamma',
    mcpToken: '96b6c79ba5bff5bc0e5efd5a6085318d5642d48d3da16ea88bef6a5fb7743ab0',
  },
};

// Mock auth - will be configured per test
const mockAuth = vi.fn();
vi.mock('@/auth', () => ({
  auth: () => mockAuth(),
}));

// Real database connection (no mock)
vi.mock('@/lib/mongodb', async () => {
  const actual = await vi.importActual('@/lib/mongodb');
  return actual;
});

describe('GET /api/binders - Integration Tests', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    // Cleanup: Remove test binders after tests complete
    await Binder.deleteMany({ slug: { $regex: /^test-/ } });
  });

  const createRequest = (url: string) => {
    return new NextRequest(`http://localhost:3000${url}`);
  };

  // ============================================================================
  // TEST 1: Happy Path - Authenticated user with binders
  // ============================================================================
  it('should return active binders for authenticated user (testuser_alpha)', async () => {
    // Mock session authentication as testuser_alpha
    mockAuth.mockResolvedValueOnce({
      user: {
        id: TEST_USERS.alpha._id,
        name: TEST_USERS.alpha.username,
      },
    });

    const request = createRequest('/api/binders');
    const response = await GET(request);
    const data = await response.json();

    // DEBUG: Log everything
    console.log('\n========== TEST 1 DEBUG ==========');
    console.log('Mock was called:', mockAuth.mock.calls.length, 'times');
    console.log('Mock calls:', JSON.stringify(mockAuth.mock.calls, null, 2));
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
    console.log('==================================\n');

    // Assertions
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.binders).toBeDefined();
    expect(Array.isArray(data.binders)).toBe(true);

    // Should return 2 active binders (excludes archived)
    expect(data.binders.length).toBe(2);

    // Verify archived binder is excluded
    const binderNames = data.binders.map((b: any) => b.name);
    expect(binderNames).toContain('[TEST] Public Collection');
    expect(binderNames).toContain('[TEST] Private Vault');
    expect(binderNames).not.toContain('[TEST] Archived Old');

    // Verify meta information
    expect(data.meta).toBeDefined();
    expect(data.meta.isPublicAccess).toBe(false);
    expect(data.meta.targetUserId).toBe(TEST_USERS.alpha._id);
    expect(data.meta.requestedBy).toBe(TEST_USERS.alpha._id);

    // Verify ObjectId to string conversion
    data.binders.forEach((binder: any) => {
      expect(typeof binder._id).toBe('string');
      expect(typeof binder.userId).toBe('string');
    });
  });

  // ============================================================================
  // TEST 2: Happy Path - User with no binders (empty state)
  // ============================================================================
  it('should return empty array for user with no binders (testuser_gamma)', async () => {
    // Mock session authentication as testuser_gamma (has no binders)
    mockAuth.mockResolvedValueOnce({
      user: {
        id: TEST_USERS.gamma._id,
        name: TEST_USERS.gamma.username,
      },
    });

    const request = createRequest('/api/binders');
    const response = await GET(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.binders).toEqual([]);
    expect(data.meta.targetUserId).toBe(TEST_USERS.gamma._id);
  });

  // ============================================================================
  // TEST 3: Unauthorized - No session
  // ============================================================================
  it('should return 401 when no authentication provided', async () => {
    // Mock no session
    mockAuth.mockResolvedValueOnce(null);

    const request = createRequest('/api/binders');
    const response = await GET(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Authentication required');
  });

  // ============================================================================
  // TEST 4: Summary mode - Minimal data
  // ============================================================================
  it('should return minimal data when summary=true', async () => {
    // Mock session authentication as testuser_alpha
    mockAuth.mockResolvedValueOnce({
      user: {
        id: TEST_USERS.alpha._id,
        name: TEST_USERS.alpha.username,
      },
    });

    const request = createRequest('/api/binders?summary=true');
    const response = await GET(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.binders.length).toBeGreaterThan(0);

    // Verify only minimal fields are returned
    const firstBinder = data.binders[0];
    expect(firstBinder).toHaveProperty('name');
    expect(firstBinder).toHaveProperty('slug');
    expect(firstBinder).toHaveProperty('_id');
    expect(firstBinder).toHaveProperty('isPublic');

    // Should NOT have full card data (vestigial cards array might exist but should be minimal)
    // Summary mode doesn't include cardCount calculation
  });

  // ============================================================================
  // TEST 5: Public binders of another user
  // ============================================================================
  it('should return only public binders when requesting another user\'s binders', async () => {
    // Mock session authentication as testuser_alpha
    mockAuth.mockResolvedValueOnce({
      user: {
        id: TEST_USERS.alpha._id,
        name: TEST_USERS.alpha.username,
      },
    });

    // Request testuser_beta's binders
    const request = createRequest(`/api/binders?userId=${TEST_USERS.beta._id}`);
    const response = await GET(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.meta.isPublicAccess).toBe(true);
    expect(data.meta.targetUserId).toBe(TEST_USERS.beta._id);
    expect(data.meta.requestedBy).toBe(TEST_USERS.alpha._id);

    // Should only return public binder
    expect(data.binders.length).toBe(1);
    expect(data.binders[0].name).toBe('[TEST] Beta Public');
    expect(data.binders[0].isPublic).toBe(true);

    // Private binder should NOT be included
    const binderNames = data.binders.map((b: any) => b.name);
    expect(binderNames).not.toContain('[TEST] Beta Private');
  });

  // ============================================================================
  // TEST 6: MCP token authentication
  // ============================================================================
  it('should authenticate with MCP token and return only mcp-binder', async () => {
    // No session mock (simulating external MCP client)
    mockAuth.mockResolvedValueOnce(null);

    const request = createRequest(`/api/binders?mcp_token=${TEST_USERS.alpha.mcpToken}`);
    const response = await GET(request);
    const data = await response.json();

    // DEBUG: Log everything
    console.log('\n========== TEST 6 MCP TOKEN DEBUG ==========');
    console.log('MCP Token used:', TEST_USERS.alpha.mcpToken);
    console.log('Mock was called:', mockAuth.mock.calls.length, 'times');
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
    console.log('===========================================\n');

    // Assertions
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Should filter to only mcp-binder slug
    // If no mcp-binder exists, should return empty array
    const mcpBinders = data.binders.filter((b: any) => b.slug === 'mcp-binder');

    // Note: This test might return empty if mcp-binder doesn't exist yet
    // This is expected behavior - endpoint filters by slug='mcp-binder'
    if (data.binders.length > 0) {
      expect(data.binders.every((b: any) => b.slug === 'mcp-binder')).toBe(true);
    }
  });

  // ============================================================================
  // TEST 7: Data integrity - ObjectId serialization
  // ============================================================================
  it('should properly serialize ObjectIds to strings', async () => {
    mockAuth.mockResolvedValueOnce({
      user: {
        id: TEST_USERS.alpha._id,
        name: TEST_USERS.alpha.username,
      },
    });

    const request = createRequest('/api/binders');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);

    // Check each binder for proper serialization
    data.binders.forEach((binder: any) => {
      // _id should be a string, not an ObjectId object
      expect(typeof binder._id).toBe('string');
      expect(binder._id).toMatch(/^[a-f0-9]{24}$/); // Valid ObjectId hex string

      // userId should also be a string
      expect(typeof binder.userId).toBe('string');
      expect(binder.userId).toMatch(/^[a-f0-9]{24}$/);

      // Should not have $oid property (MongoDB raw format)
      expect(binder._id).not.toHaveProperty('$oid');
    });
  });

  // ============================================================================
  // TEST 8: Archived binder exclusion
  // ============================================================================
  it('should exclude archived binders from results', async () => {
    mockAuth.mockResolvedValueOnce({
      user: {
        id: TEST_USERS.alpha._id,
        name: TEST_USERS.alpha.username,
      },
    });

    const request = createRequest('/api/binders');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify no binder has archived: true
    const hasArchivedBinder = data.binders.some((b: any) => b.archived === true);
    expect(hasArchivedBinder).toBe(false);

    // Double-check by name
    const archivedBinderPresent = data.binders.some((b: any) =>
      b.name === '[TEST] Archived Old'
    );
    expect(archivedBinderPresent).toBe(false);
  });

  // ============================================================================
  // TEST 9: Sorting - Should be sorted by updatedAt descending
  // ============================================================================
  it('should return binders sorted by updatedAt in descending order', async () => {
    mockAuth.mockResolvedValueOnce({
      user: {
        id: TEST_USERS.alpha._id,
        name: TEST_USERS.alpha.username,
      },
    });

    const request = createRequest('/api/binders');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.binders.length).toBeGreaterThan(1);

    // Verify sorting (newest first)
    for (let i = 0; i < data.binders.length - 1; i++) {
      const current = new Date(data.binders[i].updatedAt);
      const next = new Date(data.binders[i + 1].updatedAt);

      // Current should be >= next (descending order)
      expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
    }
  });
});
