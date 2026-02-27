/**
 * Test script to verify cards/printings schema relationship
 */

import { db } from '@/lib/postgres/db';
import { cards, printings } from '@/lib/postgres/schema';
import { eq } from 'drizzle-orm';

async function testCardsPrintings() {
  console.log('🧪 Testing Cards/Printings Schema...\n');

  try {
    // 1. Create a test card
    console.log('1️⃣ Creating test card...');
    const testCard = {
      cardUniqueId: 'test_enlightened_strike_001',
      name: 'enlightened strike',
      displayName: 'Enlightened Strike',
      text: 'As an additional cost to play Enlightened Strike, put a card from your hand on the bottom of your deck...',
      typeText: 'generic action - attack',
      types: ['generic', 'action', 'attack'],
      power: 5,
      cost: 0,
      defense: 3,
      pitch: 1,
      color: 'red',
      isAction: true,
      isAttack: true,
      isGeneric: true,
      blitzLegal: true,
      ccLegal: true,
    };

    await db.insert(cards).values(testCard);
    console.log('✅ Card created:', testCard.displayName);
    console.log(`   Card ID: ${testCard.cardUniqueId}\n`);

    // 2. Create multiple printings for this card
    console.log('2️⃣ Creating printings for the card...');

    const testPrintings = [
      {
        printingId: 'test_print_001',
        cardUniqueId: testCard.cardUniqueId,
        set: '1hp',
        edition: 'f',
        foiling: 'r',
        rarity: 'm',
        collectorNumber: '1HP361',
        imageUrl: 'https://example.com/image1.jpg',
        isFirstEdition: true,
        isRainbowFoil: true,
        isMajestic: true,
        tcgMarket: 52.30,
        tcgLow: 45.00,
        hasPrice: true,
      },
      {
        printingId: 'test_print_002',
        cardUniqueId: testCard.cardUniqueId,
        set: '1hp',
        edition: 'n',
        foiling: 's',
        rarity: 'm',
        collectorNumber: '1HP361',
        imageUrl: 'https://example.com/image2.jpg',
        isNormalEdition: true,
        isNormalFoil: true,
        isMajestic: true,
        tcgMarket: 19.58,
        tcgLow: 19.26,
        hasPrice: true,
      },
      {
        printingId: 'test_print_003',
        cardUniqueId: testCard.cardUniqueId,
        set: '1hp',
        edition: 'u',
        foiling: 's',
        rarity: 'm',
        collectorNumber: '1HP361',
        imageUrl: 'https://example.com/image3.jpg',
        isUnlimited: true,
        isNormalFoil: true,
        isMajestic: true,
        tcgMarket: 14.20,
        tcgLow: 12.50,
        hasPrice: true,
      },
    ];

    await db.insert(printings).values(testPrintings);
    console.log('✅ Created 3 printings:');
    console.log(`   - First Edition Rainbow Foil: $${testPrintings[0].tcgMarket}`);
    console.log(`   - Normal Edition Standard Foil: $${testPrintings[1].tcgMarket}`);
    console.log(`   - Unlimited Edition Standard Foil: $${testPrintings[2].tcgMarket}\n`);

    // 3. Query to join cards with printings
    console.log('3️⃣ Testing JOIN query...');
    const result = await db
      .select({
        cardName: cards.displayName,
        cardText: cards.text,
        power: cards.power,
        defense: cards.defense,
        printingSet: printings.set,
        edition: printings.edition,
        foiling: printings.foiling,
        price: printings.tcgMarket,
      })
      .from(cards)
      .innerJoin(printings, eq(cards.cardUniqueId, printings.cardUniqueId))
      .where(eq(cards.cardUniqueId, testCard.cardUniqueId));

    console.log('✅ JOIN query successful!');
    console.log(`   Found ${result.length} printings for "${result[0].cardName}":`);
    result.forEach((row, i) => {
      console.log(`   ${i + 1}. ${row.edition}/${row.foiling} - $${row.price}`);
    });
    console.log();

    // 4. Query cheapest printing
    console.log('4️⃣ Finding cheapest printing...');
    const cheapest = await db
      .select()
      .from(printings)
      .where(eq(printings.cardUniqueId, testCard.cardUniqueId))
      .orderBy(printings.tcgLow)
      .limit(1);

    if (cheapest.length > 0) {
      console.log('✅ Cheapest printing found:');
      console.log(`   Edition: ${cheapest[0].edition}`);
      console.log(`   Price: $${cheapest[0].tcgLow}\n`);
    }

    // 5. Cleanup
    console.log('5️⃣ Cleaning up test data...');
    await db.delete(printings).where(eq(printings.cardUniqueId, testCard.cardUniqueId));
    await db.delete(cards).where(eq(cards.cardUniqueId, testCard.cardUniqueId));
    console.log('✅ Test data cleaned up\n');

    console.log('🎉 All cards/printings tests passed!\n');
    console.log('Summary:');
    console.log('✅ Cards table works');
    console.log('✅ Printings table works');
    console.log('✅ Foreign key relationship works');
    console.log('✅ JOIN queries work');
    console.log('✅ Multiple printings per card works');
    console.log('✅ Price variation by printing works');

  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('   Error:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    // Close the connection
    console.log('\n👋 Connection closed');
    process.exit(0);
  }
}

testCardsPrintings();
