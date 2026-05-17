import { execSync } from 'child_process';

/**
 * Security Audit Script — Kiểm tra bảo mật chuỗi cung ứng (Skill 10)
 */
const runAudit = () => {
  console.log('🛡️  Đang bắt đầu quá trình Security Audit (Elite SaaS 2026)...');

  try {
    // 1. Kiểm tra lỗ hổng trong các thư viện (NPM Audit)
    console.log('\n[1/3] Đang kiểm tra lỗ hổng thư viện (pnpm audit)...');
    try {
      const auditOutput = execSync('pnpm audit', { encoding: 'utf8' });
      console.log(auditOutput);
    } catch (e: any) {
      // pnpm audit trả về lỗi nếu tìm thấy lỗ hổng, chúng ta vẫn in output ra
      console.log(e.stdout || 'Tìm thấy một số vấn đề bảo mật cần lưu ý.');
    }

    // 2. Kiểm tra cấu hình .env (Không được có trong Git)
    console.log('\n[2/3] Kiểm tra tệp tin nhạy cảm...');
    const gitStatus = execSync('git status --ignored', { encoding: 'utf8' });
    if (gitStatus.includes('.env')) {
      console.log('✅ Tệp .env đã được bảo vệ (đã nằm trong .gitignore).');
    } else {
      console.log('⚠️  CẢNH BÁO: Tệp .env có thể chưa được phớt lờ bởi Git!');
    }

    // 3. Kiểm tra các thư viện lỗi thời
    console.log('\n[3/3] Kiểm tra cập nhật thư viện...');
    const outdated = execSync('pnpm outdated', { encoding: 'utf8' });
    console.log(outdated || 'Tất cả thư viện đã ở phiên bản mới nhất.');

    console.log('\n✨ Quá trình Audit hoàn tất!');
  } catch (error) {
    console.error('❌ Lỗi trong quá trình Audit:', error);
  }
};

runAudit();
