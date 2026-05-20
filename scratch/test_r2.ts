import { ImageService } from '../src/services/ImageService.ts';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function testR2() {
  console.log('--- Testing Cloudflare R2 Upload ---');
  console.log('Account ID:', process.env.CLOUDFLARE_ACCOUNT_ID ? 'Configured' : 'Missing');
  console.log('Access Key:', process.env.R2_ACCESS_KEY_ID ? 'Configured' : 'Missing');
  console.log('Secret Key:', process.env.R2_SECRET_ACCESS_KEY ? 'Configured' : 'Missing');
  console.log('Bucket Name:', process.env.R2_BUCKET_NAME);
  console.log('Public Domain:', process.env.R2_PUBLIC_DOMAIN);

  try {
    // 1x1 transparent PNG image
    const validPngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      'base64'
    );

    const result = await ImageService.compressAndUpload(validPngBuffer, {
      name: 'test-image.png',
      folder: 'products/test-product-folder',
      quality: 80,
    });
    console.log('\n✅ Upload Successful!');
    console.log('Result URL:', result.url);
  } catch (error) {
    console.error('\n❌ Upload Failed:', error);
  }
}

testR2();
