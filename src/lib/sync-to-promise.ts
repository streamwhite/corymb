export function syncToPromise<T>(fn: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      resolve(fn());
    } catch (err) {
      console.error(err);
      reject(err);
    }
  });
}
