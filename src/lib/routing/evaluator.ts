/**
 * Condition tree evaluator.
 * Recursive — küçük tree'lerde performans sorunu yok (kural başına <50 düğüm).
 */
import type { Condition, ConditionOp, ConditionTree, OrderContext } from './types';

/** Field path resolver — "shipping.city" → context.shipping.city */
function resolveField(ctx: OrderContext, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = ctx;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function compare(actual: unknown, op: ConditionOp, expected: unknown): boolean {
  switch (op) {
    case 'eq':
      return actual === expected;
    case 'ne':
      return actual !== expected;
    case 'in':
      return Array.isArray(expected) && expected.includes(actual as string | number);
    case 'not_in':
      return Array.isArray(expected) && !expected.includes(actual as string | number);
    case '>=':
      return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
    case '<=':
      return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
    case '>':
      return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
    case '<':
      return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
    case 'contains':
      if (Array.isArray(actual)) return actual.includes(expected as string | number);
      if (typeof actual === 'string') return actual.includes(String(expected));
      return false;
    case 'exists':
      return actual !== undefined && actual !== null && actual !== '';
    default:
      return false;
  }
}

function isCondition(node: ConditionTree): node is Condition {
  return 'field' in node && 'op' in node;
}

export function evaluate(tree: ConditionTree, ctx: OrderContext): boolean {
  if (isCondition(tree)) {
    const actual = resolveField(ctx, tree.field);
    return compare(actual, tree.op, tree.value);
  }
  if ('all' in tree) {
    return tree.all.every((sub) => evaluate(sub, ctx));
  }
  if ('any' in tree) {
    return tree.any.some((sub) => evaluate(sub, ctx));
  }
  if ('not' in tree) {
    return !evaluate(tree.not, ctx);
  }
  return false;
}
