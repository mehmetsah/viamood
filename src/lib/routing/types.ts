/**
 * Routing engine — type definitions.
 *
 * Conditions tree örneği:
 * {
 *   "all": [
 *     { "field": "shipping.city", "op": "in", "value": ["İstanbul", "Ankara"] },
 *     {
 *       "any": [
 *         { "field": "total_cents", "op": ">=", "value": 50000 },
 *         { "field": "vendor_count", "op": ">=", "value": 3 }
 *       ]
 *     }
 *   ]
 * }
 */

export type FulfillmentMode = 'split' | 'consolidate_self' | 'consolidate_carrier';

export type ConditionOp =
  | 'eq'
  | 'ne'
  | 'in'
  | 'not_in'
  | '>='
  | '<='
  | '>'
  | '<'
  | 'contains'
  | 'exists';

export interface Condition {
  field: string;          // ör. "shipping.city", "total_cents", "vendor_count"
  op: ConditionOp;
  value?: string | number | boolean | Array<string | number>;
}

export interface AllNode {
  all: ConditionTree[];
}

export interface AnyNode {
  any: ConditionTree[];
}

export interface NotNode {
  not: ConditionTree;
}

export type ConditionTree = Condition | AllNode | AnyNode | NotNode;

/**
 * Sipariş context'i — engine'e verilen input.
 * `field` referansları bu yapıdan resolve edilir.
 */
export interface OrderContext {
  total_cents: number;
  subtotal_cents: number;
  shipping_cents: number;
  currency: string;
  vendor_count: number;
  vendor_ids: string[];
  line_item_count: number;
  total_weight_grams: number;
  shipping?: {
    city?: string;
    district?: string;
    country?: string;
    postal_code?: string;
  };
  customer?: {
    email?: string;
    is_returning?: boolean;
  };
  tags: string[];
}

export interface VendorAssignment {
  vendorId: string;
  lineItemIds: string[];
  modeOverride?: FulfillmentMode;
  shipFromLocationId?: string;
}

export interface RoutingResult {
  mode: FulfillmentMode;
  matchedRuleId: string | null;
  matchedRuleName: string | null;
  assignments: VendorAssignment[];
  reason: string;
}
