import { NextRequest, NextResponse } from 'next/server';
import { authenticateSession } from '@/lib/auth/multi-auth';

export async function POST(request: NextRequest) {
  try {
    // Authenticate the user (admin only)
    const authResult = await authenticateSession();
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the file from the form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type (images only)
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Only images are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // Prepare Cloudflare upload
    const cloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const cloudflareApiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!cloudflareAccountId || !cloudflareApiToken) {
      console.error('Cloudflare credentials not configured');
      return NextResponse.json(
        { success: false, error: 'Image upload service not configured' },
        { status: 500 }
      );
    }

    // Upload to Cloudflare Images
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);

    const cloudflareResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/images/v1`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cloudflareApiToken}`,
        },
        body: uploadFormData,
      }
    );

    const cloudflareData = await cloudflareResponse.json();

    if (!cloudflareResponse.ok || !cloudflareData.success) {
      console.error('Cloudflare upload failed:', cloudflareData);
      return NextResponse.json(
        { success: false, error: 'Failed to upload image to Cloudflare' },
        { status: 500 }
      );
    }

    // Extract the image ID and construct the URL
    const imageId = cloudflareData.result.id;
    const imageUrl = `https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/${imageId}/public`;

    return NextResponse.json({
      success: true,
      data: {
        imageId,
        imageUrl,
        variants: cloudflareData.result.variants,
      },
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
