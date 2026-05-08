import { describe, expect, it } from 'vitest';
import { evaluate } from '@/lib/routing/evaluator';
import type { ConditionTree, OrderContext } from '@/lib/routing/types';

const baseCtx: OrderContext = {
  total_cents: 50000,
  subtotal_cents: 45000,
  shipping_cents: 5000,
  currency: 'TRY',
  vendor_count: 2,
  vendor_ids: ['v1', 'v2'],
  line_item_count: 3,
  total_weight_grams: 1500,
  shipping: {
    city: 'İstanbul',
    district: 'Beyoğlu',
    country: 'TR',
    postal_code: '34433',
  },
  customer: {
    email: 'test@example.com',
  },
  tags: ['retail'],
};

describe('routing evaluator', () => {
  it('eq simple', () => {
    const tree: ConditionTree = { field: 'shipping.city', op: 'eq', value: 'İstanbul' };
    expect(evaluate(tree, baseCtx)).toBe(true);
  });

  it('eq miss', () => {
    const tree: ConditionTree = { field: 'shipping.city', op: 'eq', value: 'Ankara' };
    expect(evaluate(tree, baseCtx)).toBe(false);
  });

  it('numeric >=', () => {
    const tree: ConditionTree = { field: 'total_cents', op: '>=', value: 50000 };
    expect(evaluate(tree, baseCtx)).toBe(true);
  });

  it('numeric < miss', () => {
    const tree: ConditionTree = { field: 'total_cents', op: '<', value: 50000 };
    expect(evaluate(tree, baseCtx)).toBe(false);
  });

  it('in array', () => {
    const tree: ConditionTree = { field: 'shipping.city', op: 'in', value: ['İstanbul', 'Ankara'] };
    expect(evaluate(tree, baseCtx)).toBe(true);
  });

  it('all node — both true', () => {
    const tree: ConditionTree = {
      all: [
        { field: 'total_cents', op: '>=', value: 50000 },
        { field: 'vendor_count', op: '>=', value: 2 },
      ],
    };
    expect(evaluate(tree, baseCtx)).toBe(true);
  });

  it('all node — one false', () => {
    const tree: ConditionTree = {
      all: [
        { field: 'total_cents', op: '>=', value: 100000 },
        { field: 'vendor_count', op: '>=', value: 2 },
      ],
    };
    expect(evaluate(tree, baseCtx)).toBe(false);
  });

  it('any node — at least one', () => {
    const tree: ConditionTree = {
      any: [
        { field: 'total_cents', op: '>=', value: 100000 },
        { field: 'vendor_count', op: '>=', value: 2 },
      ],
    };
    expect(evaluate(tree, baseCtx)).toBe(true);
  });

  it('not node', () => {
    const tree: ConditionTree = {
      not: { field: 'shipping.city', op: 'eq', value: 'Ankara' },
    };
    expect(evaluate(tree, baseCtx)).toBe(true);
  });

  it('exists for empty field', () => {
    const tree: ConditionTree = { field: 'customer.is_returning', op: 'exists' };
    expect(evaluate(tree, baseCtx)).toBe(false);
  });

  it('contains string in array', () => {
    const tree: ConditionTree = { field: 'tags', op: 'contains', value: 'retail' };
    expect(evaluate(tree, baseCtx)).toBe(true);
  });

  it('nested all/any', () => {
    const tree: ConditionTree = {
      all: [
        { field: 'shipping.country', op: 'eq', value: 'TR' },
        {
          any: [
            { field: 'total_cents', op: '>=', value: 100000 },
            { field: 'vendor_count', op: '>=', value: 2 },
          ],
        },
      ],
    };
    expect(evaluate(tree, baseCtx)).toBe(true);
  });
});
