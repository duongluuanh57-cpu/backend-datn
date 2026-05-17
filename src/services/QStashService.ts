import { Client } from '@upstash/qstash';

/**
 * QStashService — Quản lý Message Queue và Scheduled Jobs
 * Sử dụng Upstash QStash (Serverless, HTTP-based)
 */
export class QStashService {
  private static client = new Client({
    token: process.env.QSTASH_TOKEN || '',
  });

  /**
   * Đẩy một job vào hàng đợi để xử lý bất đồng bộ
   * @param path Đường dẫn endpoint nhận xử lý (ví dụ: /process-email)
   * @param body Dữ liệu truyền vào job
   * @param delayMs Thời gian trì hoãn thực hiện (milisec)
   */
  static async publish(path: string, body: any, delaySec: number = 0) {
    const url = `${process.env.APP_WEBHOOK_URL}${path}`;
    
    return this.client.publishJSON({
      url,
      body,
      delay: delaySec,
    });
  }

  /**
   * Tạo một lịch trình chạy định kỳ (Cron Job)
   * @param name Tên định danh lịch trình
   * @param path Endpoint nhận xử lý
   * @param cron Biểu thức cron (ví dụ: "0 0 * * *" cho mỗi ngày)
   */
  static async createSchedule(path: string, cron: string, body: any = {}) {
    const url = `${process.env.APP_WEBHOOK_URL}${path}`;

    return this.client.schedules.create({
      destination: url,
      cron,
      body: JSON.stringify(body),
    });
  }
}
