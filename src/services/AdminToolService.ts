/**
 * AdminToolService — Barrel file (re-export từ các module nhỏ hơn)
 *
 * File này được giữ lại để backward compatibility.
 * Code thực tế đã được tách vào thư mục `services/adminTool/`:
 *   - adminToolDeclarations.ts → getDeclarations, getUserDeclarations
 *   - adminToolExecutor.ts     → AdminToolExecutor
 */
export { getDeclarations, getUserDeclarations } from './adminTool/adminToolDeclarations.ts';
export { AdminToolExecutor } from './adminTool/adminToolExecutor.ts';

// Re-import cho backward-compatible class
import { getDeclarations as _getDeclarations, getUserDeclarations as _getUserDeclarations } from './adminTool/adminToolDeclarations.ts';
import { AdminToolExecutor } from './adminTool/adminToolExecutor.ts';

// ============================================================
// Backward-compatible AdminToolService class
// Giữ nguyên tên class + method signatures để không break imports
// ============================================================
export class AdminToolService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  static getDeclarations() {
    return _getDeclarations();
  }

  static getUserDeclarations() {
    return _getUserDeclarations();
  }

  async execute(name: string, args: Record<string, any>): Promise<any> {
    const executor = new AdminToolExecutor(this.tenantId);
    return executor.execute(name, args);
  }
}