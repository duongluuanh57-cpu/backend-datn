import { User } from '../models/User.ts';
import type { IUser } from '../models/User.ts';

export class UserRepository {
  static async findByEmail(email: string): Promise<IUser | null> {
    return User.findOne({ email }).lean();
  }

  static async findByUsername(username: string): Promise<IUser | null> {
    return User.findOne({ username }).lean();
  }

  static async create(userData: Partial<IUser>): Promise<IUser> {
    const user = new User(userData);
    return user.save();
  }

  static async findByOAuthId(provider: string, oauthId: string): Promise<IUser | null> {
    return User.findOne({ oauthProvider: provider, oauthId }).lean();
  }

  static async findById(id: string): Promise<IUser | null> {
    return User.findById(id).lean();
  }

  static async update(id: string, data: Partial<IUser>): Promise<IUser | null> {
    return User.findByIdAndUpdate(id, data, { new: true });
  }

  static async findAll(tenantId: string): Promise<IUser[]> {
    return User.find({ tenantId }).sort({ createdAt: -1 }).lean();
  }

  static async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await User.deleteOne({ _id: id, tenantId });
    return result.deletedCount > 0;
  }
}
