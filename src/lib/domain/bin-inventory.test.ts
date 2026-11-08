import { describe, expect, it } from 'vitest';
import { buildBinSavePayload, mergeBinSources } from './bin-inventory';

describe('buildBinSavePayload', () => {
  it('preserves saved inventory on an inactive capacity tier during replace-all', () => {
    const payload = buildBinSavePayload({
      rates: [
        { id: 'active-240', isActive: true },
        { id: 'inactive-660', isActive: false },
      ],
      savedBins: [
        { capacityRateId: 'inactive-660', quantity: 3 },
      ],
      quantities: { 'active-240': 2, 'inactive-660': 0 },
    });

    expect(payload).toEqual([
      { capacityRateId: 'active-240', quantity: 2 },
      { capacityRateId: 'inactive-660', quantity: 3 },
    ]);
  });

  it('omits active tiers whose quantity is zero', () => {
    const payload = buildBinSavePayload({
      rates: [
        { id: 'active-240', isActive: true },
        { id: 'active-660', isActive: true },
      ],
      savedBins: [{ capacityRateId: 'active-660', quantity: 1 }],
      quantities: { 'active-240': 2, 'active-660': 0 },
    });

    expect(payload).toEqual([
      { capacityRateId: 'active-240', quantity: 2 },
    ]);
  });

  it('preserves saved inventory whose capacity rate is missing from the catalogue', () => {
    const payload = buildBinSavePayload({
      rates: [{ id: 'active-240', isActive: true }],
      savedBins: [{ capacityRateId: 'retired-1100', quantity: 4 }],
      quantities: { 'active-240': 1 },
    });

    expect(payload).toEqual([
      { capacityRateId: 'active-240', quantity: 1 },
      { capacityRateId: 'retired-1100', quantity: 4 },
    ]);
  });
});

describe('mergeBinSources', () => {
  it('unions profile and option bins without losing an inactive source', () => {
    expect(
      mergeBinSources(
        [{ capacityRateId: 'active-240', quantity: 2 }],
        [
          { capacityRateId: 'active-240', quantity: 1 },
          { capacityRateId: 'inactive-660', quantity: 3 },
        ],
      ),
    ).toEqual([
      { capacityRateId: 'active-240', quantity: 2 },
      { capacityRateId: 'inactive-660', quantity: 3 },
    ]);
  });
});
