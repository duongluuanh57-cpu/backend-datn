// @ts-ignore
import autocannon from 'autocannon';

/**
 * Script kiểm thử chịu tải (Load Testing) cho API
 */
const run = () => {
  const instance = autocannon({
    url: process.env.API_URL || 'https://elite-saas-backend.onrender.com',
    connections: 100, // 100 kết nối đồng thời
    duration: 10,     // Chạy trong 10 giây
    pipelining: 1,
    title: 'SaaS Core API Benchmark'
  }, (err: any, result: any) => {
    if (err) {
      console.error('Lỗi khi chạy benchmark:', err);
    }
  });

  // Hiển thị tiến trình
  autocannon.track(instance, { renderProgressBar: true });
};

console.log('🚀 Đang bắt đầu kiểm thử chịu tải...');
run();
