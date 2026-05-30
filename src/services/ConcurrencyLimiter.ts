/**
 * ConcurrencyLimiter — giới hạn số lượng tác vụ đồng thời
 * Dùng để bảo vệ Gemini API khỏi quá tải khi có nhiều request cùng lúc
 */
export class ConcurrencyLimiter {
  private running = 0;
  private queue: Array<{
    resolve: (value: () => Promise<any>) => void;
    reject: (err: Error) => void;
    priority: number;
    timestamp: number;
  }> = [];
  private maxConcurrent: number;
  private maxQueueSize: number;

  constructor(maxConcurrent: number = 10, maxQueueSize: number = 100) {
    this.maxConcurrent = maxConcurrent;
    this.maxQueueSize = maxQueueSize;
  }

  get pending(): number {
    return this.queue.length;
  }

  get active(): number {
    return this.running;
  }

  /** Chờ đến khi có slot rồi trả về release function */
  async acquire(priority: number = 0): Promise<() => void> {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return () => this.release();
    }

    if (this.queue.length >= this.maxQueueSize) {
      throw new Error('Server is busy. Please try again later.');
    }

    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject, priority, timestamp: Date.now() });
      this.queue.sort((a, b) => b.priority - a.priority || a.timestamp - b.timestamp);
    }).then((task: any) => {
      this.running++;
      return () => {
        this.release();
        task?.();
      };
    });
  }

  private release(): void {
    this.running--;
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next.resolve(async () => {});
    }
  }

  getStats() {
    return {
      active: this.running,
      pending: this.queue.length,
      maxConcurrent: this.maxConcurrent,
      maxQueueSize: this.maxQueueSize,
    };
  }
}

/** Global limiter — 10 Gemini calls đồng thời, queue tối đa 200 */
export const geminiLimiter = new ConcurrencyLimiter(10, 200);
