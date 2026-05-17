import mongoose, { Schema, Document } from 'mongoose';

export interface IKnowledge extends Document {
  question: string;
  answer: string;
  tenantId: string;
  createdAt: Date;
}

const KnowledgeSchema: Schema = new Schema({
  question: { type: String, required: true, index: true },
  answer: { type: String, required: true },
  tenantId: { type: String, default: 'default-tenant' },
  createdAt: { type: Date, default: Date.now },
});

// Đảm bảo không lưu trùng câu hỏi cho cùng một tenant
KnowledgeSchema.index({ question: 1, tenantId: 1 }, { unique: true });

export const Knowledge = mongoose.model<IKnowledge>('Knowledge', KnowledgeSchema);
