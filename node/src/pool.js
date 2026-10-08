// Run `fn` over `items` with a fixed number of concurrent workers.
export async function runPool(items, concurrency, fn, { shouldStop = () => false } = {}) {
  let next = 0;
  const workers = [];
  const worker = async () => {
    while (next < items.length && !shouldStop()) {
      const item = items[next++];
      await fn(item);
    }
  };
  for (let i = 0; i < Math.max(1, Math.min(concurrency, items.length)); i++) workers.push(worker());
  await Promise.all(workers);
}
