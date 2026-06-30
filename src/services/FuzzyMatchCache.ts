type CacheEntry<T> = {
  items: T[];
  lookup: Map<string, T>;
  timestamp: number;
};

export class FuzzyMatchCache {
  private static store = new Map<string, CacheEntry<any>>();
  private static TTL = 5 * 60 * 1000;
  private static MAX_SIZE = 200; // Giới hạn số lượng cache entry để tránh tràn RAM

  static normalize(s: string): string {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  /** Dọn dẹp entry hết hạn và giới hạn kích thước */
  private static evictIfNeeded(): void {
    const now = Date.now();
    // Xóa entry hết hạn
    for (const [key, entry] of this.store) {
      if (now - entry.timestamp >= this.TTL) {
        this.store.delete(key);
      }
    }
    // Nếu vẫn vượt giới hạn, xóa entry cũ nhất (LRU-style)
    if (this.store.size >= this.MAX_SIZE) {
      let oldestKey = '';
      let oldestTime = Infinity;
      for (const [key, entry] of this.store) {
        if (entry.timestamp < oldestTime) {
          oldestTime = entry.timestamp;
          oldestKey = key;
        }
      }
      if (oldestKey) this.store.delete(oldestKey);
    }
  }

  static async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T[]>,
    nameAccessor: (item: T) => string = (item: any) => item.name
  ): Promise<{ items: T[]; lookup: Map<string, T> }> {
    const cached = this.store.get(key);
    if (cached && Date.now() - cached.timestamp < this.TTL) {
      return { items: cached.items, lookup: cached.lookup };
    }

    const items = await fetcher();
    const lookup = new Map<string, T>();
    for (const item of items) {
      lookup.set(this.normalize(nameAccessor(item)), item);
    }

    this.evictIfNeeded();
    this.store.set(key, { items, lookup, timestamp: Date.now() });
    return { items, lookup };
  }

  static fuzzyFind<T>(
    input: string,
    lookup: Map<string, T>,
    nameAccessor: (item: T) => string = (item: any) => item.name
  ): T | undefined {
    const norm = this.normalize(input);
    if (!norm) return undefined;

    const exact = lookup.get(norm);
    if (exact) return exact;

    for (const [, item] of lookup) {
      const itemNorm = this.normalize(nameAccessor(item));
      if (itemNorm.includes(norm) || norm.includes(itemNorm)) return item;
    }

    return undefined;
  }

  static fuzzyFindAll<T>(
    input: string,
    lookup: Map<string, T>,
    nameAccessor: (item: T) => string = (item: any) => item.name
  ): T[] {
    const norm = this.normalize(input);
    if (!norm) return [];

    const results: T[] = [];
    for (const [, item] of lookup) {
      const itemNorm = this.normalize(nameAccessor(item));
      if (itemNorm === norm || itemNorm.includes(norm) || norm.includes(itemNorm)) {
        results.push(item);
      }
    }
    return results;
  }

  static invalidate(key: string) {
    this.store.delete(key);
  }

  static invalidateAll() {
    this.store.clear();
  }
}
