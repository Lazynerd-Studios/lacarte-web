import { describe, expect, it } from 'vitest';
import { createCartMutationController } from './cart-mutation-controller';

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

describe('createCartMutationController', () => {
  it('applies responses in request order even when they resolve out of order', async () => {
    const applied: string[] = [];
    const controller = createCartMutationController();

    const slow = controller.enqueue(
      async () => {
        await delay(20);
        return 'slow';
      },
      (value) => applied.push(value),
    );
    const fast = controller.enqueue(
      async () => 'fast',
      (value) => applied.push(value),
    );

    await Promise.all([slow, fast]);
    expect(applied).toEqual(['slow', 'fast']);
  });

  it('keeps later mutations running after one request fails', async () => {
    const controller = createCartMutationController();

    const failed = controller.enqueue(
      async () => {
        throw new Error('request failed');
      },
      () => undefined,
    );
    const next = controller.enqueue(
      async () => 'next',
      () => undefined,
    );

    await expect(failed).resolves.toEqual({
      status: 'failed',
      error: expect.any(Error),
    });
    await expect(next).resolves.toEqual({
      status: 'applied',
      value: 'next',
    });
  });

  it('discards a response after the cart session changes', async () => {
    const applied: string[] = [];
    const controller = createCartMutationController();
    controller.setGeneration(1);

    const stale = controller.enqueue(
      async () => {
        await delay(10);
        return 'old-cart';
      },
      (value) => applied.push(value),
    );
    controller.setGeneration(2);

    await expect(stale).resolves.toEqual({ status: 'stale' });
    expect(applied).toEqual([]);
  });
});
