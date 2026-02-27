#!/usr/bin/env node

/**
 * Simple API Test Script for FabBazaar
 * 
 * Usage:
 * 1. Start your dev server: npm run dev
 * 2. Get your session cookie from browser dev tools
 * 3. Update the SESSION_COOKIE variable below
 * 4. Run: node test-api.js
 */

const BASE_URL = 'http://localhost:3000';
const SESSION_COOKIE = 'YOUR_SESSION_COOKIE_HERE'; // Replace with your actual session cookie

// Test configuration
const TEST_CONFIG = {
  cardId: '507f1f77bcf86cd799439011', // Example MongoDB ObjectId
  printingId: 'printing-123',
  otherUserId: '507f1f77bcf86cd799439012', // Example MongoDB ObjectId
};

// Helper function to make requests
async function makeRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'Cookie': SESSION_COOKIE,
    },
    credentials: 'include',
  };

  const finalOptions = { ...defaultOptions, ...options };
  
  try {
    const response = await fetch(url, finalOptions);
    const data = await response.json();
    
    return {
      status: response.status,
      data,
      success: response.ok,
    };
  } catch (error) {
    return {
      status: 0,
      data: { error: error.message },
      success: false,
    };
  }
}

// Test functions
async function testBinderAPI() {
  console.log('\n🧪 Testing Binder API...');
  
  // Test GET binder
  console.log('  📋 Getting binder...');
  const getBinder = await makeRequest('/api/binder');
  console.log(`    Status: ${getBinder.status}, Success: ${getBinder.success}`);
  
  // Test POST binder (add card)
  console.log('  ➕ Adding card to binder...');
  const addCard = await makeRequest('/api/binder', {
    method: 'POST',
    body: JSON.stringify({
      cardId: TEST_CONFIG.cardId,
      printingId: TEST_CONFIG.printingId,
      quantity: 2,
      condition: 'NM',
      forTrade: true,
      notes: 'Test card from API',
      value: '10.00'
    })
  });
  console.log(`    Status: ${addCard.status}, Success: ${addCard.success}`);
  
  // Test unauthenticated request
  console.log('  🚫 Testing unauthenticated request...');
  const unauthenticated = await makeRequest('/api/binder', {
    headers: { 'Content-Type': 'application/json' } // No cookie
  });
  console.log(`    Status: ${unauthenticated.status}, Success: ${unauthenticated.success}`);
}

async function testWantsAPI() {
  console.log('\n🧪 Testing Wants API...');
  
  // Test GET wants
  console.log('  📋 Getting wants list...');
  const getWants = await makeRequest('/api/wants');
  console.log(`    Status: ${getWants.status}, Success: ${getWants.success}`);
  
  // Test POST wants (add card)
  console.log('  ➕ Adding card to wants...');
  const addCard = await makeRequest('/api/wants', {
    method: 'POST',
    body: JSON.stringify({
      cardId: TEST_CONFIG.cardId,
      printingId: TEST_CONFIG.printingId,
      quantity: 1,
      priority: 'high',
      notes: 'Need for deck!',
      value: '15.00'
    })
  });
  console.log(`    Status: ${addCard.status}, Success: ${addCard.success}`);
}

async function testListingsAPI() {
  console.log('\n🧪 Testing Listings API...');
  
  // Test GET listings
  console.log('  📋 Getting listings...');
  const getListings = await makeRequest('/api/listings');
  console.log(`    Status: ${getListings.status}, Success: ${getListings.success}`);
  
  // Test GET WTS listings
  console.log('  📋 Getting WTS listings...');
  const getWTS = await makeRequest('/api/listings?type=wts');
  console.log(`    Status: ${getWTS.status}, Success: ${getWTS.success}`);
  
  // Test POST listing (create WTS)
  console.log('  ➕ Creating WTS listing...');
  const createListing = await makeRequest('/api/listings', {
    method: 'POST',
    body: JSON.stringify({
      type: 'wts',
      title: 'Test WTS Listing',
      description: 'Testing the listings API',
      cards: [
        {
          name: 'Lightning Bolt',
          set: 'Core Set 2021',
          rarity: 'Common',
          foiling: 'Regular',
          quantity: 4,
          price: 2.50,
          condition: 'NM'
        }
      ],
      isPublic: true,
      location: 'Test City'
    })
  });
  console.log(`    Status: ${createListing.status}, Success: ${createListing.success}`);
  
  // Test invalid listing type
  console.log('  ❌ Testing invalid listing type...');
  const invalidType = await makeRequest('/api/listings', {
    method: 'POST',
    body: JSON.stringify({
      type: 'invalid',
      title: 'Test',
      cards: []
    })
  });
  console.log(`    Status: ${invalidType.status}, Success: ${invalidType.success}`);
}

async function testAgreementsAPI() {
  console.log('\n🧪 Testing Agreements API...');
  
  // Test GET agreements
  console.log('  📋 Getting agreements...');
  const getAgreements = await makeRequest('/api/agreements');
  console.log(`    Status: ${getAgreements.status}, Success: ${getAgreements.success}`);
  
  // Test POST agreement
  console.log('  ➕ Creating agreement...');
  const createAgreement = await makeRequest('/api/agreements', {
    method: 'POST',
    body: JSON.stringify({
      user2Id: TEST_CONFIG.otherUserId,
      offeredCards: [
        {
          cardId: TEST_CONFIG.cardId,
          printingId: TEST_CONFIG.printingId,
          quantity: 2,
          condition: 'NM'
        }
      ],
      requestedCards: [
        {
          cardId: '507f1f77bcf86cd799439013',
          printingId: 'printing-456',
          quantity: 1,
          condition: 'LP'
        }
      ],
      terms: 'Meet at local game store'
    })
  });
  console.log(`    Status: ${createAgreement.status}, Success: ${createAgreement.success}`);
}

async function testMessagesAPI() {
  console.log('\n🧪 Testing Messages API...');
  
  // Test GET messages
  console.log('  📋 Getting messages...');
  const getMessages = await makeRequest(`/api/messages?userId=${TEST_CONFIG.otherUserId}`);
  console.log(`    Status: ${getMessages.status}, Success: ${getMessages.success}`);
  
  // Test POST message
  console.log('  ➕ Sending message...');
  const sendMessage = await makeRequest('/api/messages', {
    method: 'POST',
    body: JSON.stringify({
      recipientId: TEST_CONFIG.otherUserId,
      content: 'Hello! This is a test message from the API.'
    })
  });
  console.log(`    Status: ${sendMessage.status}, Success: ${sendMessage.success}`);
  
  // Test missing userId
  console.log('  ❌ Testing missing userId...');
  const missingUserId = await makeRequest('/api/messages');
  console.log(`    Status: ${missingUserId.status}, Success: ${missingUserId.success}`);
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting FabBazaar API Tests...');
  console.log(`📍 Base URL: ${BASE_URL}`);
  
  if (SESSION_COOKIE === 'YOUR_SESSION_COOKIE_HERE') {
    console.log('\n❌ ERROR: Please update the SESSION_COOKIE variable in this script!');
    console.log('  1. Start your dev server: npm run dev');
    console.log('  2. Sign in to the app in your browser');
    console.log('  3. Open browser dev tools → Network tab');
    console.log('  4. Make any request and copy the session cookie');
    console.log('  5. Update the SESSION_COOKIE variable in this script');
    return;
  }
  
  try {
    await testBinderAPI();
    await testWantsAPI();
    await testListingsAPI();
    await testAgreementsAPI();
    await testMessagesAPI();
    
    console.log('\n✅ All tests completed!');
    console.log('\n📝 Note: Some tests may fail if:');
    console.log('   - Database is empty');
    console.log('   - User IDs don\'t exist');
    console.log('   - Session is invalid');
    console.log('   - Server is not running');
    
  } catch (error) {
    console.error('\n❌ Test runner error:', error);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  makeRequest,
  testBinderAPI,
  testWantsAPI,
  testListingsAPI,
  testAgreementsAPI,
  testMessagesAPI,
  runAllTests
}; 