# Redis Cache Flow - Hệ thống AI Product Generation

## 📋 Tổng quan

Hệ thống sử dụng Redis để cache các kết quả AI generation nhằm:
- ✅ Giảm số lần gọi API Gemini (tiết kiệm chi phí)
- ✅ Tăng tốc độ response
- ✅ Giảm tải cho AI service

## 🔑 Các loại Cache

### 1. **AI Chat Cache** (`ai:chat:*`)
- **Mục đích**: Cache kết quả chat với AI assistant
- **TTL**: Không giới hạn (lưu vĩnh viễn)
- **Key format**: `ai:chat:{tenantId}:{base64(question)}`
- **Khi nào clear**: Khi cần AI học lại hoặc cập nhật kiến thức

### 2. **AI Autocomplete Cache** (`ai_autocomplete_cache:*`)
- **Mục đích**: Cache gợi ý tự động khi user đang nhập
- **TTL**: 7 ngày (604800 giây)
- **Key format**: `ai_autocomplete_cache:{field}:{base64(currentValue)}`
- **Fields**: name, description, brand, tag
- **Khi nào clear**: Khi muốn AI generate gợi ý mới

### 3. **AI Price Cache** (`ai_price_cache:*`)
- **Mục đích**: Cache phân tích giá sản phẩm
- **TTL**: 7 ngày (604800 giây)
- **Key format**: `ai_price_cache:{base64(name)}:{markup}:{size}:{basePrice}`
- **Khi nào clear**: Khi giá thị trường thay đổi

### 4. **Product List Cache** (`products:*`)
- **Mục đích**: Cache danh sách sản phẩm để hiển thị
- **TTL**: 300 giây (5 phút)
- **Keys**:
  - `products:new:tag:{tenantId}` - Sản phẩm mới
  - `products:sale:tag:{tenantId}` - Sản phẩm sale
- **Khi nào clear**: Tự động clear khi tạo/cập nhật/xóa sản phẩm

## 🚫 Điều KHÔNG có trong Cache

### ❌ KHÔNG cache AI Product Generation
- **Lý do**: Mỗi sản phẩm cần thông tin unique, không nên dùng cache
- **Flow**: User nhập tên → AI generate → Trả về frontend → User review → User bấm "Lưu"
- **Không tự động save**: AI chỉ điền form, không tự động tạo sản phẩm trong database

### ❌ KHÔNG cache Product Creation
- **Lý do**: Mỗi lần tạo sản phẩm là một transaction mới
- **Flow**: User điền form → Bấm "Lưu" → POST /api/products → Save to MongoDB

## 🔄 Cache Invalidation Strategy

### Tự động clear cache khi:
1. **Tạo sản phẩm mới** → Clear `products:new:tag:{tenantId}`
2. **Cập nhật sản phẩm** → Clear `products:new:tag:{tenantId}` và `products:sale:tag:{tenantId}`
3. **Xóa sản phẩm** → Clear `products:new:tag:{tenantId}` và `products:sale:tag:{tenantId}`

### Manual clear cache:
```bash
# Kiểm tra cache
npx tsx scratch/check_redis_cache.ts

# Clear AI cache
npx tsx scratch/clear_ai_cache.ts

# Clear product cache
npx tsx scratch/fix-tag.ts
```

## 📊 Cache Hit Rate Monitoring

### Logs để theo dõi:
- `🚀 [Autocomplete Cache Hit]` - Autocomplete cache hit
- `🚀 [Price Cache Hit]` - Price cache hit
- `🚀 [Agent Cache]` - Agent workflow cache hit

### Không có cache hit log cho:
- ❌ Product generation (không cache)
- ❌ Product creation (không cache)

## 🔍 Debugging Cache Issues

### Nếu AI generate sản phẩm trùng lặp:
1. ✅ Kiểm tra xem có cache không: `npx tsx scratch/check_redis_cache.ts`
2. ✅ Clear AI cache: `npx tsx scratch/clear_ai_cache.ts`
3. ✅ Kiểm tra taxonomy matching logic trong `AIController.ts`
4. ✅ Kiểm tra prompt có bắt buộc chọn từ database không

### Nếu sản phẩm tự động được tạo:
1. ❌ **KHÔNG phải do cache** - Cache chỉ lưu kết quả AI, không tự động save
2. ✅ Kiểm tra có useEffect nào tự động submit form không
3. ✅ Kiểm tra có hook nào trigger save không
4. ✅ Kiểm tra có debounce logic nào gọi save API không

## 🎯 Best Practices

### DO ✅
- Cache kết quả AI generation cho autocomplete (giảm API calls)
- Cache danh sách sản phẩm (tăng tốc độ load trang)
- Clear cache khi data thay đổi
- Monitor cache hit rate

### DON'T ❌
- Không cache product generation (mỗi sản phẩm là unique)
- Không cache quá lâu (max 7 ngày cho AI cache)
- Không dùng cache làm primary data store
- Không tự động save sản phẩm từ cache

## 📝 Summary

**Redis cache trong hệ thống này:**
- ✅ Cache kết quả AI để tăng tốc
- ✅ Cache danh sách sản phẩm để giảm query DB
- ❌ KHÔNG tự động tạo sản phẩm
- ❌ KHÔNG cache product generation

**Sản phẩm chỉ được tạo khi:**
1. User nhập thông tin vào form
2. AI tự động điền (hoặc user tự điền)
3. User review thông tin
4. **User bấm nút "Lưu"** ← Đây là bước duy nhất tạo sản phẩm
