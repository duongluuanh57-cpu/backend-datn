import { nanoid } from 'nanoid';
import { AIService } from './AIService.ts';
import { redisService } from './RedisService.ts';
import { Knowledge } from '../models/Knowledge.ts';

const BATCH_WINDOW_MS = 150;
const MAX_BATCH_SIZE = 15;
const MAX_WAIT_MS = 2000;

interface BatchEntry {
  shortId: string;
  question: string;
  cleanQuestion: string;
  cacheKey: string;
  context: string;
  storeOverview: string;
  adaptiveDirective: string;
  tenantId: string;
  resolve: (text: string) => void;
  reject: (err: Error) => void;
  createdAt: number;
}

class BatchBuffer {
  private queue: BatchEntry[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private maxWaitTimer: ReturnType<typeof setTimeout> | null = null;

  push(entry: Omit<BatchEntry, 'shortId' | 'createdAt' | 'resolve' | 'reject'>): Promise<string> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        ...entry,
        shortId: nanoid(8),
        createdAt: Date.now(),
        resolve,
        reject,
      });
      this.scheduleFlush();
    });
  }

  private scheduleFlush(): void {
    if (this.queue.length >= MAX_BATCH_SIZE) {
      this.flush();
      return;
    }
    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), BATCH_WINDOW_MS);
    }
    if (!this.maxWaitTimer && this.queue.length === 1) {
      this.maxWaitTimer = setTimeout(() => this.flush(), MAX_WAIT_MS);
    }
  }

  private flush(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.maxWaitTimer) { clearTimeout(this.maxWaitTimer); this.maxWaitTimer = null; }
    const batch = this.queue.splice(0);
    if (batch.length === 0) return;
    this.processBatch(batch);
  }

  private async processBatch(entries: BatchEntry[]): Promise<void> {
    // Cache lookups
    const cacheResults = await Promise.all(
      entries.map(async (e) => ({
        shortId: e.shortId,
        text: await redisService.get(e.cacheKey),
      }))
    );

    const toProcess: BatchEntry[] = [];

    for (let i = 0; i < entries.length; i++) {
      const cached = cacheResults[i].text;
      if (cached) {
        entries[i].resolve(cached);
      } else {
        toProcess.push(entries[i]);
      }
    }

    if (toProcess.length === 0) return;

    try {
      await this.callGeminiAndResolve(toProcess);
    } catch {
      // Retry 1 lần
      try {
        await this.callGeminiAndResolve(toProcess);
      } catch {
        for (const entry of toProcess) {
          entry.reject(new Error('AI temporarily unavailable. Please try again later.'));
        }
      }
    }
  }

  private async callGeminiAndResolve(entries: BatchEntry[]): Promise<void> {
    const resultMap = await AIService.createBatchChatStream(
      entries.map(e => ({
        shortId: e.shortId,
        question: e.question,
        context: e.context,
        storeOverview: e.storeOverview,
        adaptiveDirective: e.adaptiveDirective,
      }))
    );

    for (const entry of entries) {
      const answer = resultMap.get(entry.shortId);
      if (answer) {
        Promise.all([
          redisService.set(entry.cacheKey, answer),
          Knowledge.findOneAndUpdate(
            { question: entry.cleanQuestion, tenantId: entry.tenantId },
            { answer },
            { upsert: true }
          ),
        ]).catch(err => console.error('[BatchBuffer] Cache save error:', err));
        entry.resolve(answer);
      } else {
        entry.reject(new Error('AI did not return a response for this question.'));
      }
    }
  }
}

export const batchBuffer = new BatchBuffer();
