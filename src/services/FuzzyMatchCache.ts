type CacheEntry<T> = {
  items: T[];
  lookup: Map<string, T>;
  timestamp: number;
};

export class FuzzyMatchCache {
  private static store = new Map<string, CacheEntry<any>>();
  private static TTL = 5 * 60 * 1000;

  static normalize(s: string): string {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
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
