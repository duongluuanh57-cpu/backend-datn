/**
 * Test script để kiểm tra logic matching taxonomy
 * Chạy: npx tsx scratch/test_taxonomy_matching.ts
 */

// Giả lập danh sách taxonomy có sẵn trong database
const availableScentGroups = [
  'Hương hoa',
  'Hương gỗ',
  'Hương trái cây',
  'Hương cam chanh',
  'Hương phương Đông',
  'Hương xạ hương',
  'Hương hổ phách'
];

const availableConcentrations = [
  'Eau de Toilette',
  'Eau de Parfum',
  'Parfum',
  'Eau de Cologne'
];

const availableSegments = [
  'Cao cấp',
  'Trung cấp',
  'Bình dân',
  'Sang trọng'
];

// Hàm normalize để so sánh
const normalizeName = (str: string) => 
  str.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

// Hàm tìm best match
const findBestMatch = (input: string, availableList: string[]) => {
  const normalizedInput = normalizeName(input);
  
  // 1. Exact match
  const exactMatch = availableList.find(item => 
    normalizeName(item) === normalizedInput
  );
  if (exactMatch) {
    return { match: exactMatch, type: 'exact' };
  }
  
  // 2. Partial match (contains)
  const partialMatch = availableList.find(item => 
    normalizeName(item).includes(normalizedInput) || 
    normalizedInput.includes(normalizeName(item))
  );
  if (partialMatch) {
    return { match: partialMatch, type: 'partial' };
  }
  
  // 3. Fallback to first item
  return { match: availableList[0], type: 'fallback' };
};

// Test cases
console.log('🧪 Testing Scent Group Matching:\n');

const scentTests = [
  'Hương hoa',           // Exact match
  'huong hoa',           // Exact match (no diacritics)
  'Hương hoa cỏ',        // Partial match
  'Hương gỗ ấm áp',      // Partial match
  'Fresh Citrus',        // Should fallback
  'Woody Oriental'       // Should fallback
];

scentTests.forEach(test => {
  const result = findBestMatch(test, availableScentGroups);
  console.log(`Input: "${test}"`);
  console.log(`  → Match: "${result.match}" (${result.type})`);
  console.log('');
});

console.log('\n🧪 Testing Concentration Matching:\n');

const concentrationTests = [
  'Eau de Parfum',
  'EDP',
  'Eau de Parfum Intense',
  'Parfum Extract'
];

concentrationTests.forEach(test => {
  const result = findBestMatch(test, availableConcentrations);
  console.log(`Input: "${test}"`);
  console.log(`  → Match: "${result.match}" (${result.type})`);
  console.log('');
});

console.log('\n🧪 Testing Segment Matching:\n');

const segmentTests = [
  'Cao cấp',
  'Cao cap',
  'Cao cấp sang trọng',
  'Luxury Premium'
];

segmentTests.forEach(test => {
  const result = findBestMatch(test, availableSegments);
  console.log(`Input: "${test}"`);
  console.log(`  → Match: "${result.match}" (${result.type})`);
  console.log('');
});
