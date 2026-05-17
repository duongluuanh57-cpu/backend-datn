# Backend API - Elite SaaS 2026

Hệ thống Backend chuẩn doanh nghiệp, tập trung vào bảo mật, hiệu suất và trí tuệ nhân tạo (AI-Native). Được xây dựng dựa trên triết lý **"Elite Performance & Security First"**.

---

## 🔥 Các tính năng nổi bật (Elite Features)

- 🚀 **Fastify Elite Architecture**: Plugin-based, Decorators, và Layered structure.
- 🛡️ **Advanced Security**: JWT, OAuth 2.0, 2FA, Audit Log, và Anti-NoSQL Injection.
- 🧬 **Multi-tenancy**: Cô lập dữ liệu khách hàng tuyệt đối (Logical Isolation).
- 👁️ **Multimodal AI (Vision)**: Tầm nhìn AI (Gemini 3.1 Flash-Lite) đọc ảnh và sơ đồ kiến trúc.
- 🖼️ **Elite Media Optimization**: Tự động tối ưu ảnh (Sharp + WebP), giảm 80%+ dung lượng.
- 🧠 **Hybrid RAG System**: Kết hợp Vector Search (Embedding v2) và Keyword Search với thuật toán RRF.
- ⚡ **Delta Indexing**: Cơ chế MD5 Hash giúp cập nhật tri thức cực nhanh và tiết kiệm Quota.
- 🩺 **Self-Healing & Observability**: Tự phục hồi hệ thống, Sentry và PostHog Analytics.

---

## 🛠️ Stack Công nghệ

- **Runtime**: Node.js v22+ (ESM).
- **Framework**: Fastify.
- **Database**: MongoDB Atlas & Redis.
- **AI**: Google Gemini 3.1 Flash-Lite & Gemini Embedding 2.
- **Jobs**: Upstash QStash.
- **Ops**: Sentry, PostHog, Sharp, Vitest.

---

## 📂 Cấu trúc thư mục

```text
src/
├── controllers/     # Xử lý Logic Route
├── services/        # Logic nghiệp vụ (Business Logic) & AI
├── models/          # Định nghĩa Database Schemas (Mongoose)
├── repositories/    # Tầng truy cập dữ liệu (Data Access)
├── middleware/      # Auth, Error Handling, Rate Limit
├── routes/          # Khai báo các API Endpoints
├── scripts/         # Các script tiện ích (Index, Media Test...)
├── config/          # Cấu hình DB, Redis, Sentry
└── utils/           # Helper functions & Plugins
```

---

## 🧠 Hệ thống AI Intelligence (Elite RAG)

Dự án tích hợp trí tuệ nhân tạo thế hệ mới:
1. **Multimodal Vision**: AI có khả năng "nhìn" và phân tích hình ảnh/tài liệu phi cấu trúc.
2. **Gemini Embedding 2**: Sử dụng `gemini-embedding-2` (3072 dims) cho độ chính xác tìm kiếm vượt trội.
3. **Delta Indexing**: Cơ chế thông minh chỉ index những gì thay đổi, bảo vệ API Quota.
4. **Smart Chunking**: Chia nhỏ dữ liệu logic (~1500 ký tự) kèm overlap để giữ ngữ cảnh.

---

## 📝 Giấy phép (License)
Dự án được bảo mật và thuộc quyền sở hữu cá nhân. Vui lòng không sao chép khi chưa được phép.

---
*Developed by Antigravity AI - Elite SaaS Stack 2026.*
