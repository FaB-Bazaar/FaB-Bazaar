/**
 * Migration script to add publicIds to existing articles
 *
 * Run with: npx tsx scripts/add-public-ids-to-articles.ts
 *
 * This script:
 * 1. Finds all articles without a publicId
 * 2. Generates a unique publicId for each using nanoid
 * 3. Updates the database with the new publicIds
 * 4. Reports progress and results
 */

// Load environment variables from .env.local
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local first (higher priority), then .env as fallback
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { nanoid } from 'nanoid';
import connectToDatabase from '../lib/mongodb';
import Article from '../models/Article';

async function addPublicIdsToArticles() {
  try {
    console.log('🚀 Starting migration: Adding publicIds to articles...\n');

    // Connect to database
    await connectToDatabase();
    console.log('✅ Connected to database\n');

    // Find all articles without a publicId
    const articlesWithoutPublicId = await Article.find({
      $or: [
        { publicId: { $exists: false } },
        { publicId: null },
        { publicId: '' }
      ]
    }).select('_id title slug').lean();

    const totalArticles = articlesWithoutPublicId.length;

    if (totalArticles === 0) {
      console.log('✅ All articles already have publicIds. Nothing to migrate.');
      process.exit(0);
    }

    console.log(`📊 Found ${totalArticles} articles without publicIds\n`);
    console.log('⏳ Generating and assigning publicIds...\n');

    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ articleId: string; title: string; error: string }> = [];

    // Process each article
    for (let i = 0; i < totalArticles; i++) {
      const article = articlesWithoutPublicId[i];

      try {
        // Generate unique publicId (10 characters for good collision resistance)
        let publicId = nanoid(10);
        let existingArticle = await Article.findOne({ publicId });

        // Extremely unlikely, but regenerate if collision occurs
        let attempts = 0;
        while (existingArticle && attempts < 5) {
          publicId = nanoid(10);
          existingArticle = await Article.findOne({ publicId });
          attempts++;
        }

        if (attempts >= 5) {
          throw new Error('Failed to generate unique publicId after 5 attempts');
        }

        // Update the article with the new publicId
        await Article.findByIdAndUpdate(article._id, { publicId });

        successCount++;

        // Log progress every 10 articles or on the last article
        if ((i + 1) % 10 === 0 || i + 1 === totalArticles) {
          console.log(`   Progress: ${i + 1}/${totalArticles} articles processed`);
        }

      } catch (error) {
        errorCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({
          articleId: article._id.toString(),
          title: article.title,
          error: errorMessage
        });
        console.error(`   ❌ Error processing article "${article.title}": ${errorMessage}`);
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total articles found:        ${totalArticles}`);
    console.log(`Successfully updated:        ${successCount}`);
    console.log(`Errors:                      ${errorCount}`);
    console.log('='.repeat(60));

    if (errors.length > 0) {
      console.log('\n❌ ERRORS:\n');
      errors.forEach(err => {
        console.log(`  Article ID: ${err.articleId}`);
        console.log(`  Title: ${err.title}`);
        console.log(`  Error: ${err.error}\n`);
      });
    }

    if (successCount === totalArticles) {
      console.log('\n✅ Migration completed successfully!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Migration completed with errors. Please review the errors above.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Fatal error during migration:');
    console.error(error);
    process.exit(1);
  }
}

// Run the migration
addPublicIdsToArticles();
