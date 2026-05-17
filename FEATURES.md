# 🛠 Backend Feature Specification

Tài liệu này chi tiết các tính năng kỹ thuật cao cấp đã được hiện thực hóa trong hệ thống Backend.

---

## 1. 🧠 AI Knowledge Engine (Internal NotebookLM)
Đây là tính năng cốt lõi biến hệ thống thành một nền tảng thông minh.
- **Hybrid Search Architecture**: Kết hợp Vector Search (ngữ nghĩa) và Keyword Search (từ khóa) thông qua thuật toán **Reciprocal Rank Fusion (RRF)** để đạt độ chính xác tối ưu.
- **Project Indexing**: Script tự động quét, chunking và tạo embedding cho toàn bộ tài liệu (.md) và mã nguồn (.ts).
- **Contextual AI Chat**: AI không chỉ trả lời suông mà dựa trên "tri thức thực tế" được truy vấn từ Database (RAG).

## 2. 🏢 SaaS Multi-tenancy (Logical Isolation)
Thiết kế chuẩn cho các ứng dụng phần mềm dịch vụ (SaaS).
- **Data Isolation**: Mọi bản ghi đều gắn chặt với một `tenantId`.
- **Automatic Filtering**: Sử dụng Mongoose Plugin để tự động thêm điều kiện lọc `tenantId` vào mọi câu lệnh Query, ngăn chặn rò rỉ dữ liệu giữa các khách hàng.
- **Tenant-based Rate Limiting**: Giới hạn băng thông linh hoạt cho từng khách hàng khác nhau.

## 3. 🔐 Advanced Auth & Security Hardening
Hệ thống bảo mật đa tầng chống lại các cuộc tấn công hiện đại.
- **Hybrid Authentication**: Hỗ trợ cả Email/Password truyền thống và Social Login (Google, GitHub) qua OAuth 2.0.
- **Two-Factor Authentication (2FA)**: Tích hợp mã xác thực 6 số (TOTP) với cơ chế mã hóa Secret Key trong Database.
- **JWT Session Management**: Sử dụng Access Token ngắn hạn và Refresh Token dài hạn, kết hợp Blacklist trong Redis khi người dùng đăng xuất.
- **Audit Logging**: Tự động ghi lại các hành động nhạy cảm (đổi mật khẩu, xóa dữ liệu, đăng nhập thất bại) để phục vụ việc tra soát.

## 4. ⚡ Event-Driven & Background Processing
Đảm bảo Backend luôn phản hồi nhanh (Low Latency).
- **Upstash QStash**: Xử lý tác vụ nền (gửi Email, xử lý ảnh, AI tasks) theo mô hình Serverless Message Queue.
- **Webhook Security**: Xác thực chữ ký số (Signature Verification) cho mọi request từ QStash để đảm bảo an toàn.
- **Job Idempotency**: Cơ chế chống xử lý lặp lại các tác vụ nền.

## 5. 📈 Observability & Full-stack Analytics
Giám sát mọi ngóc ngách của hệ thống.
- **Sentry Integration**: Theo dõi lỗi Real-time kèm theo Context chi tiết (User ID, Request Payload).
- **PostHog Analytics**: Phân tích hành vi người dùng (User Events) và quản lý Feature Flags (bật/tắt tính năng từ xa).
- **Infrastructure Monitoring**: Expose các metrics chuẩn Prometheus (`/metrics`) để quan sát tài nguyên hệ thống (CPU, RAM, Event Loop Lag).

## 6. 🚀 Performance Optimization
- **Lean Mongoose**: Luôn sử dụng `.lean()` cho các tác vụ chỉ đọc để giảm tải RAM.
- **Redis Caching**: Cache kết quả phản hồi AI và các Query nặng để giảm chi phí API và tăng tốc độ.
- **Sharp Image Processing**: Tự động nén và resize hình ảnh sang định dạng WebP/AVIF trước khi lưu trữ.

---
*Tài liệu này được biên soạn bởi Antigravity AI - Elite SaaS Stack 2026.*
