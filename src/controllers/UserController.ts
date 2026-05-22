import type { FastifyRequest, FastifyReply } from 'fastify';
import { UserRepository } from '../repositories/UserRepository.ts';

export class UserController {
  /**
   * GET /api/users
   * Lấy danh sách người dùng (Admin only)
   * Query params: page, limit, search, role
   */
  static async getAllUsers(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = (request as any).user?.tenantId || 'default';
      const query = request.query as { page?: string; limit?: string; search?: string; role?: string };

      // Nếu không có page, trả full list (backward compatible)
      if (!query.page) {
        const users = await UserRepository.findAll(tenantId);
        const safeUsers = users.map(u => {
          const { passwordHash, ...rest } = u as any;
          return rest;
        });
        return reply.send({ success: true, data: safeUsers });
      }

      const result = await UserRepository.findPaginated(tenantId, {
        page: parseInt(query.page, 10),
        limit: query.limit ? parseInt(query.limit, 10) : 10,
        search: query.search,
        role: query.role,
      });

      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * PATCH /api/users/:id
   * Cập nhật thông tin người dùng
   */
  static async updateUser(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const data = request.body as any;
      
      // Bảo mật: Không cho phép đổi role qua đây nếu không phải Super Admin
      // (Trong bài tập này chúng ta giả định admin có thể cập nhật)
      
      const user = await UserRepository.update(id, data);
      if (!user) {
        return reply.status(404).send({
          success: false,
          message: 'Không tìm thấy người dùng',
        });
      }

      return reply.send({
        success: true,
        message: 'Cập nhật thành công',
        data: user,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * PATCH /api/users/:id/role
   * Cập nhật vai trò người dùng
   */
  static async updateUserRole(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const { role } = request.body as { role: 'USER' | 'ADMIN' };
      
      if (!role || !['USER', 'ADMIN'].includes(role)) {
        return reply.status(400).send({
          success: false,
          message: 'Vai trò không hợp lệ',
        });
      }
      
      const user = await UserRepository.update(id, { role });
      if (!user) {
        return reply.status(404).send({
          success: false,
          message: 'Không tìm thấy người dùng',
        });
      }

      return reply.send({
        success: true,
        message: 'Cập nhật vai trò thành công',
        data: user,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * DELETE /api/users/:id
   * Xóa người dùng
   */
  static async deleteUser(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const tenantId = (request as any).user?.tenantId || 'default';
      
      const success = await UserRepository.delete(id, tenantId);
      if (!success) {
        return reply.status(404).send({
          success: false,
          message: 'Không tìm thấy người dùng để xóa',
        });
      }

      return reply.send({
        success: true,
        message: 'Đã xóa người dùng thành công',
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        message: error.message,
      });
    }
  }
}
