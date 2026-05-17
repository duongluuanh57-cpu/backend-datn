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
   * @param to Địa chỉ người nhận
   * @param subject Tiêu đề email
   * @param html Nội dung email định dạng HTML
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
   * Gửi email chào mừng
   */
  static async sendWelcomeEmail(to: string, name: string) {
    const subject = `Chào mừng ${name} đến với hệ thống!`;
    const html = `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #333;">Chào mừng bạn, ${name}!</h2>
        <p>Cảm ơn bạn đã đăng ký tài khoản tại hệ thống của chúng tôi.</p>
        <p>Chúc bạn có những trải nghiệm tuyệt vời.</p>
        <hr style="border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 12px; color: #999;">Đây là email tự động, vui lòng không phản hồi.</p>
      </div>
    `;

    return this.sendEmail(to, subject, html);
  }
}
