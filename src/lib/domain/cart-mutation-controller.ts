export type CartMutationResult<T> =
  | { status: 'applied'; value: T }
  | { status: 'stale' }
  | { status: 'failed'; error: unknown };

export function createCartMutationController() {
  let queue = Promise.resolve();
  let generation = 0;

  return {
    setGeneration(value: number) {
      generation = value;
    },
    async enqueue<T>(
      request: () => Promise<T>,
      apply: (value: T) => void,
    ): Promise<CartMutationResult<T>> {
      const requestGeneration = generation;

      return new Promise((resolve) => {
        queue = queue.then(async () => {
          if (requestGeneration !== generation) {
            resolve({ status: 'stale' });
            return;
          }

          try {
            const value = await request();
            if (requestGeneration !== generation) {
              resolve({ status: 'stale' });
              return;
            }

            apply(value);
            resolve({ status: 'applied', value });
          } catch (error) {
            resolve({ status: 'failed', error });
          }
        });
      });
    },
  };
}
