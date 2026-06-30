import type { FastifyInstance } from 'fastify';
import { adminAuthMiddleware } from '../middleware/adminAuthMiddleware.ts';
import { csrfProtection } from '../middleware/csrfMiddleware.ts';
import { AdminPageController } from '../controllers/admin/AdminPageController.ts';
import { AdminCRUDController } from '../controllers/admin/AdminCRUDController.ts';
import { AdminCRUDControllerPart2 } from '../controllers/admin/AdminCRUDControllerPart2.ts';

export async function adminRoutes(app: FastifyInstance) {
  // Rate limit cho admin: 120 req/phút (2x so với user thường)
  app.addHook('preHandler', adminAuthMiddleware);

  // Rate limit cứng cho form submit
  app.addHook('preHandler', async (req, reply) => {
    if (['POST','PUT','PATCH','DELETE'].includes(req.method)) {
      const ip = req.ip;
      const key = `admin-rl:${ip}`;
      // Đơn giản: dùng biến global để đếm (production nên dùng Redis)
      const now = Date.now();
      const windowMs = 60000;
      const maxReqs = 30;

      if (!(app as any).__rateLimitStore) (app as any).__rateLimitStore = {};
      const store = (app as any).__rateLimitStore;
      if (!store[key]) store[key] = [];
      store[key] = store[key].filter((t: number) => now - t < windowMs);
      if (store[key].length >= maxReqs) {
        return reply.status(429).send('Vượt quá giới hạn thao tác. Vui lòng thử lại sau 1 phút.');
      }
      store[key].push(now);
    }
  });

  // CSRF bảo vệ tất cả POST/PUT/DELETE
  app.addHook('preHandler', csrfProtection);

  // Dashboard
  app.get('/', AdminPageController.dashboard);

  // ── Products CRUD ──
  app.get('/products', AdminCRUDController.productList);
  app.get('/products/:id', AdminCRUDController.productDetail);
  app.post('/products/:id/delete', AdminCRUDController.productDelete);

  // ── Supplement sản phẩm: chi tiết (phải đặt TRƯỚC /products/supplement) ──
  app.get('/products/supplement/:id', AdminCRUDController.productSupplementDetail);

  // ── Supplement sản phẩm: danh sách ──
  app.get('/products/supplement', AdminCRUDController.productSupplement);

  // ── Brands CRUD ──
  app.get('/brands', AdminCRUDController.brandList);
  app.post('/brands/:id/delete', AdminCRUDController.brandDelete);

  // ── Categories CRUD ──
  app.get('/categories', AdminCRUDController.categoryList);
  app.post('/categories/:id/delete', AdminCRUDController.categoryDelete);

  // ── Orders CRUD ──
  app.get('/orders', AdminCRUDControllerPart2.orderList);
  app.get('/orders/:id', AdminCRUDControllerPart2.orderDetail);

  // ── Vouchers CRUD ──
  app.get('/vouchers', AdminCRUDControllerPart2.voucherList);
  app.post('/vouchers/:id/delete', AdminCRUDControllerPart2.voucherDelete);

  // ── Users CRUD ──
  app.get('/users', AdminCRUDControllerPart2.userList);
  app.post('/users/:id/delete', AdminCRUDControllerPart2.userDelete);

  // ── Media Library ──
  app.get('/media', AdminPageController.mediaPage);

  // ── Settings ──
  app.get('/settings', AdminPageController.settingsPage);
  app.post('/settings', AdminPageController.settingsSave);

  // Logout
  app.post('/logout', AdminPageController.logout);
}
