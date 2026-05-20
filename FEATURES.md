# 🛠 Backend Feature Specification

Tài liệu này chi tiết các tính năng kỹ thuật cao cấp đã được hiện thực hóa trong hệ thống Backend.

---

## 1. 🔐 Authentication & Security System

### JWT Authentication
- **Access Token**: Short-lived (15 minutes), chứa userId, role
- **Refresh Token**: Long-lived (7 days), stored in Redis với blacklist support
- **Token Rotation**: Automatic refresh khi access token hết hạn
- **Logout**: Blacklist tokens trong Redis để revoke ngay lập tức

### OAuth 2.0 Integration
- **Google Login**: Full OAuth flow với callback handling
- **Account Linking**: Tự động link Google account với existing user
- **Profile Sync**: Sync avatar và profile info từ Google

### Two-Factor Authentication (2FA)
- **TOTP Implementation**: Time-based OTP với Speakeasy
- **QR Code Generation**: Tự động generate QR code cho Google Authenticator
- **Backup Codes**: Generate recovery codes khi setup 2FA
- **Verification**: Verify 6-digit code trước khi enable/disable

### Security Hardening
- **Dynamic Rate Limiting**: 
  - Guest: 100 requests/minute
  - User: 500 requests/minute
  - Admin: 10,000 requests/minute (unlimited)
- **Helmet Security Headers**: XSS, HSTS, CSP protection
- **CORS Configuration**: Whitelist specific origins
- **Input Validation**: Zod schemas cho tất cả endpoints
- **Audit Logging**: Track sensitive actions (login, password change, data deletion)

---

## 2. 🧠 AI & Machine Learning System

### Multimodal AI (Gemini 3.1 Flash-Lite)
- **Vision Capabilities**: Analyze product images, extract features
- **Text Generation**: Product descriptions, marketing copy
- **Structured Output**: JSON responses với type safety
- **Streaming Support**: Real-time AI responses

### Semantic Search Engine
- **Gemini Embedding 2**: 3072-dimensional vectors
- **Vector Storage**: MongoDB với vector indexes
- **Similarity Search**: Cosine similarity cho semantic matching
- **Hybrid Search**: Combine vector + keyword search với RRF algorithm

### RAG (Retrieval-Augmented Generation)
- **Knowledge Base**: Store documents, product info, FAQs
- **Smart Chunking**: Split documents (~1500 chars) với overlap
- **Delta Indexing**: MD5 hash để chỉ re-index changed content
- **Context Retrieval**: Top-K relevant chunks cho AI responses

### AI Agent System (LangGraph)
- **Multi-step Workflows**: Complex AI tasks với state management
- **Tool Calling**: AI có thể call functions (search, calculate, etc.)
- **Memory Management**: Conversation history và context
- **Failover**: Automatic retry với exponential backoff

---

## 3. 🛒 E-commerce Core Features

### Product Management
- **CRUD Operations**: Full product lifecycle management
- **Variants Support**: Size, color, material variants
- **Image Management**: Multiple images per product với ordering
- **SEO Optimization**: Meta title, description, slug generation
- **Inventory Tracking**: Real-time stock management
- **Pricing**: Regular price, compare-at price, cost tracking

### Brand & Taxonomy System
- **Brand Management**: Create, update, delete brands
- **Taxonomy Classification**: 
  - Segments (e.g., Men, Women, Unisex)
  - Scent Groups (e.g., Floral, Woody, Fresh)
  - Concentrations (e.g., EDP, EDT, Parfum)
- **Standard Tags**: Predefined tags cho filtering
- **AI-powered Categorization**: Auto-suggest categories based on product data

### Order Processing
- **Order Creation**: Cart to order conversion
- **Order Items**: Line items với product snapshots
- **Order Status**: Pending → Processing → Shipped → Delivered
- **Payment Integration**: Ready for Stripe/PayPal integration
- **User Addresses**: Multiple shipping addresses per user

### Search & Filtering
- **Text Search**: Full-text search trên name, description, tags
- **Faceted Filtering**: Filter by brand, category, price range, tags
- **Sorting**: Price, name, created date, popularity
- **Pagination**: Efficient pagination với total count

---

## 4. �️ Media Processing System

### Image Optimization
- **Sharp Processing**: High-performance image manipulation
- **WebP Conversion**: Automatic conversion to WebP (80%+ size reduction)
- **Multiple Sizes**: Generate thumbnail, medium, large sizes
- **Quality Control**: Configurable quality settings
- **Format Support**: JPEG, PNG, WebP input

### Cloudflare R2 Storage
- **S3-Compatible API**: Easy migration from S3
- **Zero Egress Fees**: No bandwidth charges
- **CDN Integration**: Fast global delivery
- **Public URLs**: Direct access to optimized images
- **Batch Upload**: Multiple images in single request

### Product Image Management
- **Multiple Images**: Up to 10 images per product
- **Image Ordering**: Drag-and-drop reordering
- **Primary Image**: Set featured image
- **Lazy Loading**: Optimized for frontend performance

---

## 5. ⚡ Performance & Scalability

### Redis Caching Strategy
- **Session Storage**: JWT refresh tokens
- **Rate Limiting**: Request counters per user/IP
- **API Response Cache**: Cache expensive queries (5-15 min TTL)
- **AI Response Cache**: Cache AI-generated content
- **Cache Invalidation**: Smart invalidation on data updates

### Database Optimization
- **Lean Queries**: Use `.lean()` for read-only operations (5x faster)
- **Selective Fields**: Only fetch needed fields
- **Indexes**: Compound indexes for common queries
- **Connection Pooling**: Reuse database connections
- **Aggregation Pipeline**: Complex queries với MongoDB aggregation

### Background Jobs (QStash)
- **Email Sending**: Welcome emails, order confirmations
- **AI Indexing**: Batch indexing of knowledge base
- **Image Processing**: Async image optimization
- **Cleanup Tasks**: Delete old sessions, expired tokens
- **Webhook Delivery**: Reliable webhook delivery với retries

### Compression
- **Response Compression**: Gzip/Brotli for API responses
- **Image Compression**: WebP với quality optimization
- **JSON Minification**: Remove whitespace in production

---

## 6. 📊 Monitoring & Observability

### Error Tracking (Sentry)
- **Real-time Alerts**: Instant notification on errors
- **Stack Traces**: Full error context với source maps
- **User Context**: User ID, email, request data
- **Performance Monitoring**: Track slow endpoints
- **Release Tracking**: Associate errors với specific releases

### Product Analytics (PostHog)
- **Event Tracking**: User actions, page views, conversions
- **Feature Flags**: A/B testing, gradual rollouts
- **Session Replay**: Debug user issues
- **Funnel Analysis**: Track conversion funnels
- **Cohort Analysis**: User segmentation

### Prometheus Metrics
- **HTTP Metrics**: Request count, latency, error rate
- **System Metrics**: CPU, memory, event loop lag
- **Custom Metrics**: Business metrics (orders, revenue)
- **Grafana Integration**: Beautiful dashboards

### Health Checks
- **Database Health**: MongoDB connection status
- **Redis Health**: Redis connection status
- **API Health**: Overall system status
- **Ping Endpoint**: Fast health check for load balancers

---

## 7. 🏗️ Architecture Patterns

### Layered Architecture
```
Controller → Service → Repository → Database
```
- **Controllers**: HTTP request/response handling
- **Services**: Business logic, orchestration
- **Repositories**: Data access, queries
- **Models**: Mongoose schemas, validation

### Dependency Injection
- **Service Injection**: Controllers receive services via constructor
- **Testability**: Easy to mock dependencies
- **Flexibility**: Swap implementations without changing code

### Error Handling
- **Custom Error Classes**: ValidationError, NotFoundError, UnauthorizedError
- **Global Error Handler**: Centralized error processing
- **Structured Errors**: Consistent error response format
- **Error Logging**: All errors logged to Sentry

### Validation Strategy
- **Zod Schemas**: Type-safe validation at route level
- **Request Validation**: Body, query, params validation
- **Response Validation**: Ensure API contract compliance
- **Custom Validators**: Business rule validation in services

---

## 8. 🔧 Developer Experience

### TypeScript Excellence
- **Strict Mode**: Full type safety
- **Type Inference**: Minimal type annotations needed
- **ESM Support**: Native ES modules
- **Node v22 Features**: Native TypeScript execution với `--strip-types`

### Hot Reload
- **Watch Mode**: Automatic restart on file changes
- **Fast Refresh**: Quick iteration cycle
- **Error Recovery**: Graceful error handling

### Testing Infrastructure
- **Vitest**: Fast unit testing
- **Test Coverage**: Track code coverage
- **Integration Tests**: Test full request/response cycle
- **Mocking**: Easy service mocking

### Migration Scripts
- **Product Images**: Migrate images to R2
- **Order Items**: Migrate order structure
- **Taxonomies**: Migrate product categories
- **Idempotent**: Safe to run multiple times

---

## 9. 🚀 Production Ready

### Deployment
- **Environment Variables**: Comprehensive config management
- **Build Process**: Optimized production build với esbuild
- **Health Checks**: Kubernetes/Docker ready
- **Graceful Shutdown**: Clean connection closing

### Scalability
- **Horizontal Scaling**: Stateless design
- **Load Balancing**: Ready for multiple instances
- **Database Sharding**: MongoDB sharding support
- **CDN Integration**: Static assets via CDN

### Security Checklist
- ✅ JWT with short expiration
- ✅ Password hashing (bcrypt)
- ✅ Rate limiting
- ✅ CORS configuration
- ✅ Security headers (Helmet)
- ✅ Input validation (Zod)
- ✅ SQL injection prevention (Mongoose)
- ✅ XSS prevention
- ✅ CSRF protection
- ✅ Audit logging

---

## 📈 Current Implementation Status

### ✅ Completed Features
- Authentication (JWT, OAuth, 2FA)
- Product Management (CRUD, variants, images)
- Order Processing
- AI Chat & Search
- Image Optimization
- Brand & Taxonomy
- User Addresses
- Rate Limiting
- Error Tracking
- Analytics
- Health Checks
- Background Jobs

### 🚧 In Progress
- Payment Integration (Stripe)
- Email Templates
- Advanced Analytics Dashboard
- Multi-language Support

### 📋 Planned Features
- Inventory Alerts
- Product Reviews
- Wishlist
- Discount Codes
- Shipping Integration
- Invoice Generation

---

*Tài liệu này được biên soạn bởi Antigravity AI - Elite SaaS Stack 2026.*
