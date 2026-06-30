import mongoose, { Document, Schema } from 'mongoose';

export interface IFavorite extends Document {
  userId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

const FavoriteSchema = new Schema<IFavorite>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    tenantId: { type: String, required: true, index: true },
  },
  {
    timestamps: true,
    collection: 'favorites',
  }
);

// Unique compound index: one user can only favorite a product once
FavoriteSchema.index({ userId: 1, productId: 1 }, { unique: true });
FavoriteSchema.index({ tenantId: 1, userId: 1 });
FavoriteSchema.index({ tenantId: 1, createdAt: -1 });

export const Favorite = mongoose.models.Favorite || mongoose.model<IFavorite>('Favorite', FavoriteSchema);