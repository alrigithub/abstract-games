/** Fixed-size object pool — no per-frame allocations in hot paths. */
export class ObjectPool<T> {
  private free: T[] = [];
  private readonly factory: () => T;
  private readonly reset: (item: T) => void;

  constructor(factory: () => T, reset: (item: T) => void, initial = 8) {
    this.factory = factory;
    this.reset = reset;
    for (let i = 0; i < initial; i++) this.free.push(factory());
  }

  acquire(): T {
    return this.free.pop() ?? this.factory();
  }

  release(item: T): void {
    this.reset(item);
    this.free.push(item);
  }
}
