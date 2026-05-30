import mongoose, { Document, Schema } from 'mongoose';
import { multiTenancyPlugin } from '../utils/multiTenancyPlugin.ts';

export interface IMedia extends Document {
  tenantId: string;
  url: string;
  displayUrl: string;
  originalBytes: number;
  compressedBytes: number;
  filename: string;
  createdAt: Date;
  updatedAt: Date;
}

const MediaSchema = new Schema<IMedia>(
  {
    url: { type: String, required: true },
    displayUrl: { type: String, required: true },
    originalBytes: { type: Number, default: 0 },
    compressedBytes: { type: Number, default: 0 },
    filename: { type: String, default: '' },
  },
  {
    timestamps: true,
    collection: 'media'
  }
);

MediaSchema.plugin(multiTenancyPlugin);

export const Media =
  mongoose.models.Media ||
  mongoose.model<IMedia>('Media', MediaSchema);
