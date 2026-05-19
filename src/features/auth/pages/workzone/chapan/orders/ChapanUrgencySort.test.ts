/**
 * Sprint 13: Smoke tests for B1/D1 urgency sort logic
 * Tests the sort comparator used in ChapanOrders and ChapanProduction.
 */
import { describe, expect, it } from 'vitest';
import type { ChapanOrder } from '@/entities/order/types';

// Mirrors the sort logic in ChapanOrders.tsx
function sortByUrgency(orders: Pick<ChapanOrder, 'urgency' | 'priority'>[]): typeof orders {
  return [...orders].sort((a, b) => {
    const urgA = (a.urgency ?? a.priority) === 'urgent' ? 0 : 1;
    const urgB = (b.urgency ?? b.priority) === 'urgent' ? 0 : 1;
    return urgA - urgB;
  });
}

describe('B1/D1: urgency sort comparator', () => {
  it('urgent order comes before normal', () => {
    const orders = [
      { urgency: 'normal' as const, priority: 'normal' },
      { urgency: 'urgent' as const, priority: 'urgent' },
    ];
    const sorted = sortByUrgency(orders);
    expect(sorted[0].urgency).toBe('urgent');
    expect(sorted[1].urgency).toBe('normal');
  });

  it('multiple urgents stay before normals', () => {
    const orders = [
      { urgency: 'normal' as const, priority: 'normal' },
      { urgency: 'urgent' as const, priority: 'urgent' },
      { urgency: 'normal' as const, priority: 'normal' },
      { urgency: 'urgent' as const, priority: 'urgent' },
    ];
    const sorted = sortByUrgency(orders);
    expect(sorted[0].urgency).toBe('urgent');
    expect(sorted[1].urgency).toBe('urgent');
    expect(sorted[2].urgency).toBe('normal');
    expect(sorted[3].urgency).toBe('normal');
  });

  it('legacy vip priority does NOT sort as urgent', () => {
    const orders = [
      { urgency: 'normal' as const, priority: 'vip' },
      { urgency: 'normal' as const, priority: 'normal' },
    ];
    const sorted = sortByUrgency(orders);
    // vip is demanding, not urgent — should stay in relative order
    expect(sorted[0].priority).toBe('vip');
    expect(sorted[1].priority).toBe('normal');
    // Both have urgA=1, urgB=1 → stable (no reorder)
  });

  it('urgency field takes priority over legacy priority field', () => {
    // Mismatched: urgency=normal but priority=urgent (old data)
    const orders = [
      { urgency: 'normal' as const, priority: 'urgent' },
      { urgency: 'urgent' as const, priority: 'normal' },
    ];
    const sorted = sortByUrgency(orders);
    // urgency field wins
    expect(sorted[0].urgency).toBe('urgent');
    expect(sorted[1].urgency).toBe('normal');
  });

  it('all normal — order preserved (stable)', () => {
    const orders = [
      { urgency: 'normal' as const, priority: 'normal' },
      { urgency: 'normal' as const, priority: 'normal' },
    ];
    const sorted = sortByUrgency(orders);
    expect(sorted).toHaveLength(2);
    expect(sorted.every(o => o.urgency === 'normal')).toBe(true);
  });
});
