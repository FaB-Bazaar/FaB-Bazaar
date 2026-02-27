// test/encryption-test.ts - Simple test to verify encryption works
import { encryptAddress, decryptAddress, encryptUserShippingAddress, decryptUserShippingAddress } from '@/lib/encryption';

function testEncryption() {
  console.log('🧪 Testing address encryption...');
  
  // Test 1: Basic string encryption
  const testAddress = "123 Main St, Anytown, CA 12345";
  const encrypted = encryptAddress(testAddress);
  const decrypted = decryptAddress(encrypted);
  
  console.log('✅ Test 1 - Basic encryption:');
  console.log('  Original:', testAddress);
  console.log('  Encrypted:', encrypted.encrypted.substring(0, 20) + '...');
  console.log('  Decrypted:', decrypted);
  console.log('  Match:', testAddress === decrypted ? '✅' : '❌');
  
  // Test 2: Object encryption
  const addressObj = {
    street: "123 Main St",
    city: "Anytown", 
    state: "CA",
    zip: "12345",
    country: "US"
  };
  
  const encryptedObj = encryptUserShippingAddress(addressObj);
  const decryptedObj = decryptUserShippingAddress(encryptedObj);
  
  console.log('\n✅ Test 2 - Object encryption:');
  console.log('  Original:', JSON.stringify(addressObj));
  console.log('  Decrypted:', JSON.stringify(decryptedObj));
  console.log('  Match:', JSON.stringify(addressObj) === JSON.stringify(decryptedObj) ? '✅' : '❌');
  
  // Test 3: Empty values
  const emptyEncrypted = encryptAddress('');
  const emptyDecrypted = decryptAddress(emptyEncrypted);
  
  console.log('\n✅ Test 3 - Empty values:');
  console.log('  Empty encryption works:', emptyDecrypted === '' ? '✅' : '❌');
  
  console.log('\n🎉 Encryption tests complete!');
}

// Run the test
testEncryption();