# 📑 Backend API Documentation - Elite SaaS 2026

Hệ thống API được thiết kế theo chuẩn RESTful, tích hợp bảo mật đa lớp và các tính năng AI tiên tiến.

---

## 🔐 1. Authentication (Xác thực)
| Endpoint | Method | Mô tả |
| :--- | :--- | :--- |
| `/auth/register` | `POST` | Đăng ký tài khoản mới. |
| `/auth/login` | `POST` | Đăng nhập và nhận Access Token + Refresh Token. |
| `/auth/refresh` | `POST` | Sử dụng Refresh Token để cấp lại Access Token mới. |
| `/auth/logout` | `POST` | Đăng xuất (đưa Refresh Token vào Redis Blacklist). |
| `/oauth/google` | `GET` | Đăng nhập bằng Google OAuth. |
| `/oauth/github` | `GET` | Đăng nhập bằng GitHub OAuth. |

---

## 🧠 2. AI Intelligence (Trí tuệ nhân tạo)
Sử dụng mô hình **Gemini 3.1 Flash-Lite** cho toàn bộ hệ thống.

| Endpoint | Method | Mô tả |
| :--- | :--- | :--- |
| `/ai/generate` | `POST` | Gửi prompt và nhận phản hồi văn bản (có cache Redis). |
| `/ai/chat` | `POST` | **Streaming API**: Phản hồi thời gian thực (Vercel AI SDK). |
| `/ai/agent/run` | `POST` | Chạy quy trình đa tác nhân (Multi-agent workflow). |
| `/ai/support/chat` | `POST` | AI hỗ trợ khách hàng tích hợp hệ thống đánh giá chất lượng (Eval). |

---

## 🛡️ 3. Two-Factor Auth (Bảo mật 2 lớp)
| Endpoint | Method | Mô tả |
| :--- | :--- | :--- |
| `/2fa/setup` | `POST` | Khởi tạo 2FA, nhận Secret Key và QR Code. |
| `/2fa/verify` | `POST` | Xác thực mã OTP 6 số. |
| `/2fa/toggle` | `PATCH` | Bật/Tắt tính năng 2FA cho tài khoản. |

---

## 🛍️ 4. Product Management (Quản lý sản phẩm)
| Endpoint | Method | Mô tả |
| :--- | :--- | :--- |
| `/products/new` | `GET` | Lấy danh sách sản phẩm mới nhất (Public). |
| `/products` | `GET` | Lấy toàn bộ danh sách sản phẩm. |
| `/products/:id` | `GET` | Xem chi tiết một sản phẩm theo ID. |
| `/products` | `POST` | Tạo sản phẩm mới (Admin). |
| `/products/:id` | `PATCH` | Cập nhật thông tin sản phẩm. |
| `/products/:id` | `DELETE` | Xóa sản phẩm. |

---

## 🖼️ 5. Media & Storage (Xử lý hình ảnh)
| Endpoint | Method | Mô tả |
| :--- | :--- | :--- |
| `/media/upload` | `POST` | Upload ảnh, tự động tối ưu hóa (Sharp) sang WebP. |
| `/media/:filename`| `GET` | Truy xuất hình ảnh đã upload. |

---

## 📊 6. Stats & Monitoring (Giám sát)
| Endpoint | Method | Mô tả |
| :--- | :--- | :--- |
| `/stats/summary` | `GET` | Tổng quan số lượng User, Product, Revenue. |
| `/stats/audit` | `GET` | Truy xuất nhật ký hoạt động (Audit Logs). |
| `/metrics` | `GET` | Expose dữ liệu cho Prometheus (CPU, RAM, Lag). |

---

## ⚡ 7. Background Jobs (QStash)
| Endpoint | Method | Mô tả |
| :--- | :--- | :--- |
| `/jobs/webhook` | `POST` | Endpoint nhận thông báo từ QStash (Xử lý tác vụ nền). |

---

## 📝 Lưu ý chung
- **Base URL**: Thường là `http://localhost:3000/api` hoặc URL production.
- **Content-Type**: Luôn sử dụng `application/json`.
- **Rate Limit**: Các API Auth và AI được giới hạn 5-10 request/phút.
- **Auth Header**: `Authorization: Bearer <Access_Token>`.
