import { Payment, type PaymentMethod, type PaymentStatus } from '../models/Payment.ts';

export class PaymentService {
  static async getAll(tenantId: string) {
    return Payment.find({ tenantId })
      .populate({ path: 'orderId', select: 'customerName totalAmount status' })
      .sort({ createdAt: -1 })
      .lean();
  }

  static async getById(id: string, tenantId: string) {
    return Payment.findOne({ _id: id, tenantId })
      .populate({ path: 'orderId', select: 'customerName customerEmail totalAmount status' })
      .lean();
  }

  static async getByOrder(orderId: string, tenantId: string) {
    return Payment.find({ orderId, tenantId })
      .sort({ createdAt: -1 })
      .lean();
  }

  static async create(data: {
    orderId: string;
    method: PaymentMethod;
    amount: number;
  }, tenantId: string) {
    const payment = await Payment.create({
      orderId: data.orderId,
      method: data.method,
      amount: data.amount,
      status: 'pending',
      tenantId,
    });

    return payment;
  }

  static async markPaid(id: string, transactionCode: string | undefined, tenantId: string) {
    const payment = await Payment.findOneAndUpdate(
      { _id: id, tenantId },
      {
        $set: {
          status: 'paid' as PaymentStatus,
          transactionCode: transactionCode || undefined,
          paidAt: new Date(),
        },
      },
      { new: true }
    );

    return payment;
  }

  static async markFailed(id: string, tenantId: string) {
    return Payment.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: { status: 'failed' as PaymentStatus } },
      { new: true }
    );
  }

  static async markRefunded(id: string, tenantId: string) {
    const payment = await Payment.findOneAndUpdate(
      { _id: id, tenantId },
      {
        $set: {
          status: 'refunded' as PaymentStatus,
          refundedAt: new Date(),
        },
      },
      { new: true }
    );

    return payment;
  }

  static async delete(id: string, tenantId: string) {
    const result = await Payment.deleteOne({ _id: id, tenantId });
    return result.deletedCount > 0;
  }
}
