import { Schema, Query } from 'mongoose';

/**
 * multiTenancyPlugin — Tự động lọc dữ liệu theo tenantId cho SaaS
 */
export function multiTenancyPlugin(schema: Schema) {
  // Thêm trường tenantId vào mọi model dùng plugin này
  schema.add({
    tenantId: {
      type: String,
      required: true,
      index: true
    }
  });

  // Middleware lọc tự động khi query
  const autoFilter = function(this: Query<any, any>) {
    const filter = this.getFilter();
    
    // Nếu trong context query có _tenantId được set qua .forTenant()
    if (filter && !filter.tenantId && (this as any)._tenantId) {
      this.where({ tenantId: (this as any)._tenantId });
    }
  };

  // Áp dụng cho các hàm query (Dùng regex để bắt toàn bộ các hàm find, count, update, delete)
  schema.pre(/^find|count|update|delete/, autoFilter as any);

  // Helper method để set tenantId dễ dàng
  (schema.query as any).forTenant = function(this: any, tenantId: string) {
    this._tenantId = tenantId;
    return this.where({ tenantId });
  };
}
