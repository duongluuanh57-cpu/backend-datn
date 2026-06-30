import { Payment, type PaymentStatus } from '../models/Payment.ts';
import { PaymentMethod } from '../models/PaymentMethod.ts';

// ─── Payment Method CRUD ───

export class PaymentMethodService {
  static async getAll(tenantId: string, onlyActive = false) {
    const filter: any = { tenantId };
    if (onlyActive) filter.isActive = true;
    return PaymentMethod.find(filter).sort({ sortOrder: 1 }).lean();
  }

  static async getById(id: string, tenantId: string) {
    return PaymentMethod.findOne({ _id: id, tenantId }).lean();
  }

  static async create(data: { name: string; code: string; icon?: string; sortOrder?: number }, tenantId: string) {
    return PaymentMethod.create({
      tenantId,
      name: data.name,
      code: data.code,
      icon: data.icon || '',
      sortOrder: data.sortOrder ?? 0,
    });
  }

  static async update(id: string, data: { name?: string; icon?: string; isActive?: boolean; sortOrder?: number }, tenantId: string) {
    return PaymentMethod.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: data },
      { new: true }
    ).lean();
  }

  static async delete(id: string, tenantId: string) {
    const result = await PaymentMethod.deleteOne({ _id: id, tenantId });
    return result.deletedCount > 0;
  }
}

// ─── Payment Transaction CRUD ───

export class PaymentService {
  static async getAll(tenantId: string) {
    return Payment.find({ tenantId })
      .populate({ path: 'orderId', select: 'customerName totalAmount status' })
      .sort({ createdAt: -1 })
      .lean();
  }

  static async getById(id: string, tenantId: string) {
    return Payment.findOne({ _id: id, tenantId })
      .populate({ path: 'orderId', select: 'customerName customerPhone totalAmount status' })
      .lean();
  }

  static async getByOrder(orderId: string, tenantId: string) {
    return Payment.find({ orderId, tenantId })
      .sort({ createdAt: -1 })
      .lean();
  }

  static async create(data: { orderId: string; method: string }, tenantId: string) {
    return Payment.create({
      orderId: data.orderId,
      method: data.method,
      tenantId,
    });
  }

  static async markPaid(id: string, transactionCode: string | undefined, tenantId: string) {
    return Payment.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: { status: 'paid' as PaymentStatus, transactionCode: transactionCode || undefined, paidAt: new Date() } },
      { new: true }
    );
  }

  static async markFailed(id: string, tenantId: string) {
    return Payment.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: { status: 'failed' as PaymentStatus } },
      { new: true }
    );
  }

  static async markRefunded(id: string, tenantId: string) {
    return Payment.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: { status: 'refunded' as PaymentStatus, refundedAt: new Date() } },
      { new: true }
    );
  }

  static async delete(id: string, tenantId: string) {
    const result = await Payment.deleteOne({ _id: id, tenantId });
    return result.deletedCount > 0;
  }
}