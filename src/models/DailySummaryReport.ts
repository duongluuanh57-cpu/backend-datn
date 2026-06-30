import mongoose, { Document, Schema } from 'mongoose';

export interface IDailySummaryReport extends Document {
  date: Date;
  tenantId: string;
  totalRevenue: number;
  totalOrders: number;
  completedOrders: number;
  cancelledRevenue: number;
  updatedAt: Date;
}

const DailySummaryReportSchema = new Schema<IDailySummaryReport>(
  {
    date: { type: Date, required: true },
    tenantId: { type: String, required: true, default: 'default' },
    totalRevenue: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    completedOrders: { type: Number, default: 0 },
    cancelledRevenue: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: 'daily_summary_reports',
  }
);

DailySummaryReportSchema.index({ tenantId: 1, date: 1 }, { unique: true });
DailySummaryReportSchema.index({ date: -1 });

export const DailySummaryReport =
  mongoose.models.DailySummaryReport ||
  mongoose.model<IDailySummaryReport>('DailySummaryReport', DailySummaryReportSchema);
