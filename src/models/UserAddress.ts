import mongoose, { Document, Schema } from 'mongoose';
import { multiTenancyPlugin } from '../utils/multiTenancyPlugin.ts';

export interface IUserAddress extends Document {
  tenantId: string;
  userId: mongoose.Types.ObjectId;
  label?: string;          // VD: "Nhà riêng", "Công ty", "Ký túc xá"
  fullName?: string;       // Họ và tên người nhận
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | '';
  phoneNumber?: string;    // Số điện thoại người nhận
  address?: string;        // Số nhà, tên đường
  province?: string;       // Tỉnh / Thành phố
  district?: string;       // Quận / Huyện
  isDefault: boolean;      // Địa chỉ mặc định
  createdAt: Date;
  updatedAt: Date;
}

const UserAddressSchema = new Schema<IUserAddress>(
  {
    tenantId: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    label: { type: String, default: 'Địa chỉ của tôi' },
    fullName: { type: String, default: '' },
    gender: { type: String, enum: ['MALE', 'FEMALE', 'OTHER', ''], default: '' },
    phoneNumber: { type: String, default: '' },
    address: { type: String, default: '' },
    province: { type: String, default: '' },
    district: { type: String, default: '' },
    isDefault: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
    collection: 'user_addresses',
  }
);

UserAddressSchema.plugin(multiTenancyPlugin);

export const UserAddress =
  mongoose.models.UserAddress ||
  mongoose.model<IUserAddress>('UserAddress', UserAddressSchema);
