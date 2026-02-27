import { connectToDatabase } from '@/lib/mongodb';
import mongoose from 'mongoose';
import { db } from '@/lib/postgres/db';
import { articles } from '@/lib/postgres/schema';

async function testArticles() {
  try {
    await connectToDatabase();
    const ArticlesCollection = mongoose.connection.collection('articles');

    const mongoArticles = await ArticlesCollection.find({}).limit(1).toArray();
    console.log('Sample MongoDB article:', JSON.stringify(mongoArticles[0], null, 2));

    const article = mongoArticles[0] as any;
    const pgArticle = {
      id: article._id.toString(),
      title: article.title,
      subtitle: article.subtitle || null,
      publicId: article.publicId,
      slug: article.slug || null,
      content: article.content || null,
      authorId: article.authorId.toString(),
      status: article.status || 'draft',
      contentType: article.contentType,
      categories: article.categories || null,
      image: article.image || null,
      sections: article.sections ? JSON.stringify(article.sections) : null,
      isUserArticle: article.isUserArticle ?? false,
      heroSlug: article.heroSlug || null,
      heroClass: article.heroClass || null,
      createdAt: article.createdAt ? new Date(article.createdAt) : new Date(),
      updatedAt: article.updatedAt ? new Date(article.updatedAt) : new Date(),
    };

    console.log('\nConverted for PostgreSQL:', JSON.stringify(pgArticle, null, 2));

    await db.insert(articles).values([pgArticle]);
    console.log('\n✅ Article inserted successfully!');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error('Details:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

testArticles();
