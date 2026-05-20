import nodemailer from 'nodemailer';

/**
 * EmailService — Giao tiếp với SMTP Server (Gmail)
 * Dùng để gửi các email transactional mà không cần tên miền riêng.
 */
export class EmailService {
  private static transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 465,
    secure: true, // true cho port 465, false cho các port khác
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  /**
   * Gửi email cơ bản
   */
  static async sendEmail(to: string, subject: string, html: string) {
    const info = await this.transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    return info;
  }

  /**
   * Gửi email chào mừng — Thiết kế luxury L'essence Haute Parfumerie
   */
  static async sendWelcomeEmail(to: string, name: string) {
    const subject = `Chào mừng đến với L'essence Haute Parfumerie, ${name}!`;
    const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Chào mừng đến với L'essence</title>
</head>
<body style="margin:0;padding:0;background-color:#F9F6F3;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F9F6F3;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 30px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#2C1810 0%,#7A5C5C 50%,#C08497 100%);padding:48px 40px;text-align:center;">
              <p style="margin:0 0 8px 0;color:#F2D5C0;font-size:11px;letter-spacing:4px;text-transform:uppercase;font-family:'Georgia',serif;">MAISON DE PARFUM</p>
              <h1 style="margin:0;color:#ffffff;font-size:32px;font-weight:400;letter-spacing:3px;font-family:'Georgia',serif;">L'ESSENCE</h1>
              <p style="margin:8px 0 0 0;color:#F2D5C0;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Haute Parfumerie</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:48px 48px 32px;">
              <p style="margin:0 0 8px 0;color:#C08497;font-size:11px;letter-spacing:3px;text-transform:uppercase;">Kính chào</p>
              <h2 style="margin:0 0 24px 0;color:#2C1810;font-size:26px;font-weight:400;font-family:'Georgia',serif;">${name}</h2>

              <p style="margin:0 0 20px 0;color:#5A4A42;font-size:15px;line-height:1.8;">
                Chào mừng bạn gia nhập thế giới của <strong style="color:#7A5C5C;">L'essence Haute Parfumerie</strong> — nơi hội tụ những tinh hoa hương thơm quý tộc từ khắp nơi trên thế giới.
              </p>

              <p style="margin:0 0 32px 0;color:#5A4A42;font-size:15px;line-height:1.8;">
                Tài khoản của bạn đã được tạo thành công. Hãy bắt đầu hành trình khám phá những bộ sưu tập nước hoa niche độc quyền, được tuyển chọn kỹ lưỡng bởi các chuyên gia hàng đầu.
              </p>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="border-top:1px solid #E8D5C4;padding:0;font-size:0;line-height:0;">&nbsp;</td>
                  <td style="padding:0 16px;color:#C08497;font-size:16px;white-space:nowrap;">✦</td>
                  <td style="border-top:1px solid #E8D5C4;padding:0;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Benefits -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #F0E8E0;">
                    <p style="margin:0;color:#2C1810;font-size:14px;">🌸 &nbsp;<strong>Bộ sưu tập độc quyền</strong> — Nước hoa Niche & Luxury từ các nhà điều chế danh tiếng</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #F0E8E0;">
                    <p style="margin:0;color:#2C1810;font-size:14px;">🎁 &nbsp;<strong>Ưu đãi thành viên</strong> — Nhận thông báo sớm về sản phẩm mới và chương trình giảm giá đặc quyền</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0;">
                    <p style="margin:0;color:#2C1810;font-size:14px;">✨ &nbsp;<strong>Trải nghiệm cá nhân hóa</strong> — Gợi ý hương thơm phù hợp với cá tính riêng của bạn</p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td align="center">
                    <a href="${process.env.FRONTEND_URL || 'https://frontend-datn-tau.vercel.app'}/collections"
                       style="display:inline-block;background:linear-gradient(135deg,#7A5C5C,#C08497);color:#ffffff;text-decoration:none;padding:16px 48px;border-radius:50px;font-size:13px;letter-spacing:2px;text-transform:uppercase;font-family:'Georgia',serif;">
                      Khám phá bộ sưu tập
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#2C1810;padding:32px 40px;text-align:center;">
              <p style="margin:0 0 8px 0;color:#F2D5C0;font-size:13px;letter-spacing:2px;font-family:'Georgia',serif;">L'ESSENCE HAUTE PARFUMERIE</p>
              <p style="margin:0;color:#8B6F6F;font-size:11px;line-height:1.6;">
                Đây là email tự động, vui lòng không phản hồi trực tiếp.<br/>
                © 2026 L'essence Haute Parfumerie. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    return this.sendEmail(to, subject, html);
  }
}

