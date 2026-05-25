import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://admin-datn:qqqq1111Q%40@cluster0.jc0gpxf.mongodb.net/backend-api?retryWrites=true&w=majority&appName=Cluster0";

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;
  const col = db.collection('homepage_configs');

  // 1. Document hiện tại có field gì
  const before = await col.findOne({ tenantId: 'default-tenant' });
  console.log('=== BEFORE ===');
  console.log('Keys:', Object.keys(before || {}));
  console.log('Has productSessionLayout?', 'productSessionLayout' in (before || {}));
  if (before && 'productSessionLayout' in before) {
    console.log('Value:', JSON.stringify(before.productSessionLayout));
  }

  // 2. Ghi productSessionLayout qua updateOne
  const payload = {
    layout: 'grid',
    columnsDesktop: 6,
    columnsMobile: 2,
    rowsDesktop: 1,
    rowsMobile: 3,
    gap: 20,
    titleFontSize: 14,
    showTitle: true,
    showSubtitle: true,
    subtitleFontSize: 13,
    showFilterBar: true,
    showViewAll: true,
    sectionTitleFontSize: 24,
    showFilterBrand: true,
    showFilterScentGroup: true,
    showFilterConcentration: true,
    showFilterSegment: true,
    showFilterCapacity: true,
    showFilterPrice: true,
    showFilterSort: true,
    sessions: {
      saleProducts: { titleText: 'Test', subtitleText: 'Test', filterTag: 'sale' },
      newProducts: { titleText: 'Test', subtitleText: 'Test', filterTag: 'new' },
      limitedProducts: { titleText: 'Test', subtitleText: 'Test', filterTag: 'limited' },
      trendingProducts: { titleText: 'Test', subtitleText: 'Test', filterTag: 'trending' }
    }
  };

  const result = await col.updateOne(
    { tenantId: 'default-tenant' },
    { $set: { productSessionLayout: payload } }
  );
  console.log('\n=== UPDATE RESULT ===');
  console.log(JSON.stringify(result));

  // 3. Đọc lại
  const after = await col.findOne({ tenantId: 'default-tenant' });
  console.log('\n=== AFTER ===');
  console.log('Has productSessionLayout?', 'productSessionLayout' in (after || {}));
  if (after && 'productSessionLayout' in after) {
    console.log('columnsDesktop:', after.productSessionLayout?.columnsDesktop);
    console.log('rowsDesktop:', after.productSessionLayout?.rowsDesktop);
    console.log('Full keys:', Object.keys(after.productSessionLayout || {}));
  }

  await mongoose.disconnect();
}

main().catch(console.error);
