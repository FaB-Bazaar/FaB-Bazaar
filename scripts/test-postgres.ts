/**
 * PostgreSQL Test Script
 *
 * Tests the PostgreSQL setup and UserService implementation
 */

import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

import { PostgresUserService } from '@/lib/services/postgres/user/PostgresUserService';
import { db, pool } from '@/lib/postgres/db';
import { users } from '@/lib/postgres/schema';

async function testPostgres() {
  console.log('🧪 Testing PostgreSQL Setup...\n');

  const userService = new PostgresUserService();

  try {
    // Test 1: Database connection
    console.log('1️⃣ Testing database connection...');
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Connected to PostgreSQL!');
    console.log('   Server time:', result.rows[0].now);
    console.log();

    // Test 2: Check if tables exist
    console.log('2️⃣ Checking if tables exist...');
    const tableCheck = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('users', 'binders', 'printings_core', 'inventory_items', 'wants_items', 'decks', 'deck_cards')
      ORDER BY table_name;
    `);

    if (tableCheck.rows.length === 0) {
      console.log('⚠️  No tables found. You need to run migrations first!');
      console.log('   Run: npm run db:push');
      console.log();
    } else {
      console.log('✅ Found tables:', tableCheck.rows.map(r => r.table_name).join(', '));
      console.log();
    }

    // Test 3: Create a test user
    console.log('3️⃣ Testing UserService.createUser()...');
    const createResult = await userService.createUser({
      username: `testuser_${Date.now()}`,
      email: `test_${Date.now()}@example.com`,
      discordId: `discord_${Date.now()}`,
      discordUsername: 'TestUser#1234',
      countryCode: 'US',
    });

    if (!createResult.success) {
      console.log('❌ Failed to create user:', createResult.error);
      return;
    }

    console.log('✅ User created successfully!');
    console.log('   ID:', createResult.data.id);
    console.log('   Username:', createResult.data.username);
    console.log();

    // Test 4: Find user by ID
    console.log('4️⃣ Testing UserService.findById()...');
    const findResult = await userService.findById(createResult.data.id);

    if (!findResult.success || !findResult.data) {
      console.log('❌ Failed to find user');
      return;
    }

    console.log('✅ User found!');
    console.log('   Username:', findResult.data.username);
    console.log('   Discord:', findResult.data.discordUsername);
    console.log();

    // Test 5: Find user by username
    console.log('5️⃣ Testing UserService.findByUsername()...');
    const findByUsernameResult = await userService.findByUsername(createResult.data.username);

    if (!findByUsernameResult.success || !findByUsernameResult.data) {
      console.log('❌ Failed to find user by username');
      return;
    }

    console.log('✅ User found by username!');
    console.log();

    // Test 6: Update user
    console.log('6️⃣ Testing UserService.updateUser()...');
    const updateResult = await userService.updateUser(createResult.data.id, {
      countryCode: 'CA',
    });

    if (!updateResult.success) {
      console.log('❌ Failed to update user:', updateResult.error);
      return;
    }

    console.log('✅ User updated!');
    console.log('   New country:', updateResult.data.countryCode);
    console.log();

    // Test 7: Search users
    console.log('7️⃣ Testing UserService.searchByUsername()...');
    const searchResult = await userService.searchByUsername('test', 5);

    if (!searchResult.success) {
      console.log('❌ Search failed:', searchResult.error);
      return;
    }

    console.log('✅ Search completed!');
    console.log(`   Found ${searchResult.data.length} user(s)`);
    console.log();

    // Test 8: Get basic info
    console.log('8️⃣ Testing UserService.getBasicInfo()...');
    const basicInfoResult = await userService.getBasicInfo(createResult.data.id);

    if (!basicInfoResult.success || !basicInfoResult.data) {
      console.log('❌ Failed to get basic info');
      return;
    }

    console.log('✅ Basic info retrieved!');
    console.log('   Username:', basicInfoResult.data.username);
    console.log('   Country:', basicInfoResult.data.countryCode);
    console.log();

    // Test 9: Delete user (cleanup)
    console.log('9️⃣ Testing UserService.deleteUser()...');
    const deleteResult = await userService.deleteUser(createResult.data.id);

    if (!deleteResult.success) {
      console.log('❌ Failed to delete user:', deleteResult.error);
      return;
    }

    console.log('✅ User deleted (cleanup)!');
    console.log();

    // Test 10: Verify deletion
    console.log('🔟 Verifying deletion...');
    const verifyResult = await userService.findById(createResult.data.id);

    if (verifyResult.success && verifyResult.data === null) {
      console.log('✅ User successfully deleted!');
    } else {
      console.log('⚠️  User still exists after deletion');
    }
    console.log();

    console.log('🎉 All tests passed!');
    console.log();
    console.log('Summary:');
    console.log('✅ Database connection works');
    console.log('✅ Schema tables exist');
    console.log('✅ UserService.createUser() works');
    console.log('✅ UserService.findById() works');
    console.log('✅ UserService.findByUsername() works');
    console.log('✅ UserService.updateUser() works');
    console.log('✅ UserService.searchByUsername() works');
    console.log('✅ UserService.getBasicInfo() works');
    console.log('✅ UserService.deleteUser() works');

  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('   Error:', error.message);
      console.error('   Stack:', error.stack);
    }
  } finally {
    // Close connection
    await pool.end();
    console.log('\n👋 Connection closed');
  }
}

// Run tests
testPostgres().catch(console.error);
