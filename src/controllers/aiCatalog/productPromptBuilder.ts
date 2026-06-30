/**
 * productPromptBuilder — Xây dựng prompt cho AI generate sản phẩm
 */
export interface PromptInput {
  name: string;
  availableBrands: string[];
  availableCategories: string[];
  availableTags: string[];
  sizesJson: string;
  preFilled: Record<string, any>;
}

export function buildProductPrompt(input: PromptInput): string {
  const { name, availableBrands, availableCategories, availableTags, sizesJson, preFilled } = input;

  const finalTagsForPrompt = availableTags.filter((t: string) => t.toLowerCase() !== 'standard');

  return `
Bạn là AI chuyên gia nước hoa cao cấp. Tạo hồ sơ JSON hoàn chỉnh cho sản phẩm nước hoa có tên "${name}".

DANH SÁCH GIÁ TRỊ TRONG DATABASE (CHỈ được chọn từ đây — không ngoại lệ):
- Hãng: ${JSON.stringify(availableBrands)}
- Dung tích: ${sizesJson}
- Danh mục: ${JSON.stringify(availableCategories)}
- Tags (CHỈ chọn 1 tag phụ từ danh sách này, KHÔNG chọn "Standard" — tag Standard tự động thêm): ${JSON.stringify(finalTagsForPrompt)}

QUY TẮC:
1. Hãng (brand): PHẢI chọn CHÍNH XÁC 1 hãng từ danh sách Hãng. Nếu không chắc, chọn hãng gần nhất.
2. Tag: PHẢI chọn ĐÚNG 1 tag từ danh sách Tags trên (không chọn "Standard"). Tag "Sale" CHỈ chọn khi discountPercentage > 10 VÀ có discountEndDate. Nếu không đủ điều kiện, KHÔNG chọn "Sale".
3. Tên sản phẩm: AI tự suy luận tên sản phẩm từ hãng và phân khúc. VD: hãng "Chanel" → "Chanel Coco Mademoiselle", hãng "Dior" → "Dior Sauvage Elixir".
4. Dung tích (size): CHỈ dùng dung tích từ danh sách. Format: "size:price" cách nhau bởi dấu phẩy. BẮT BUỘC có 50ml. Các dung tích khác tùy chọn. Giá tham khảo thị trường Việt Nam (VND).
5. Price: LUÔN để 0 — sẽ tự lấy từ giá 50ml.
6. Mô tả (description): Viết tiếng Việt với ĐÚNG 3 đoạn in đậm. Mỗi đoạn cách nhau 1 dòng trống (\\n\\n).
7. Ngôn ngữ: Tất cả text bằng tiếng Việt. Không dùng tiếng Trung.
8. Giảm giá (discountPercentage): AI tự chọn 0-30%. Nếu > 10 → PHẢI điền discountStartDate & discountEndDate. Ưu tiên ngày đẹp: 7/7, 8/8, 9/9 hoặc tuần cuối tháng trong năm 2026.
9. Từ khóa (keywords): Sinh ĐÚNG 5 keywords tiếng Việt để tìm kiếm embedding.
10. Giữ nguyên pre-filled fields từ user, không thay đổi.

PRE-FILLED FIELDS (giữ nguyên): ${JSON.stringify(Object.keys(preFilled).length > 0 ? preFilled : '(không có)')}

CHỈ trả về JSON object thuần. Không markdown, không code block.

{
  "brand": "tên hãng từ danh sách",
  "tag": "tên tag từ danh sách",
  "category": "danh mục 1, danh mục 2",
  "size": "50ml:giá_tiền, size_khác:giá_tiền, ... (BẮT BUỘC có 50ml)",
  "description": "Mô tả tiếng Việt 3 đoạn in đậm",
  "discountPercentage": number,
  "discountStartDate": "ISO date string hoặc null (VD: 2026-07-07T00:00:00.000Z)",
  "discountEndDate": "ISO date string hoặc null (VD: 2026-07-31T00:00:00.000Z)",
  "longevity": "Thời gian lưu hương (VD: 7 - 9 giờ)",
  "sillage": "Độ tỏa hương (VD: 1m)",
  "durability": "Độ bền mùi (VD: Ổn định từ sáng tới chiều)",
  "scentTrail": "Vệt hương (VD: Mịn, rõ nét, sạch sẽ)",
  "season": "Mùa phù hợp, cách nhau dấu ,",
  "time": "Thời gian phù hợp, cách nhau dấu ,",
  "style": "Phong cách (VD: Lịch lãm, hiện đại)",
  "suitableFor": "Đối tượng, cách nhau dấu | (VD: văn phòng | hẹn hò)",
  "occasion": "Dịp dùng, cách nhau dấu | (VD: ban ngày | đi làm)",
  "keywords": ["từ khóa 1", "từ khóa 2", "từ khóa 3", "từ khóa 4", "từ khóa 5"]
}
`;
}