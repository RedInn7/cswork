export type OrderStatus =
  | 'creating'
  | 'pending'
  | 'processing'
  | 'paid'
  | 'partially_refunded'
  | 'refunded'
  | 'failed'
  | 'expired';
export type RefundStatus =
  | 'requested'
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'requires_action';
export type Refund = {
  id: string;
  amount: number;
  status: RefundStatus;
  reason: string;
  created_at: number;
  updated_at: number;
  last_error: string | null;
};
export type CommerceOrder = {
  id: string;
  course_id: string;
  course_title: string;
  email?: string;
  status: OrderStatus;
  amount: number | null;
  currency: string | null;
  amount_refunded: number;
  created_at: number;
  updated_at: number;
  paid_at: number | null;
  receipt_url: string | null;
  last_error: string | null;
  has_access: boolean;
  refunds?: Refund[];
  checkout_url?: string | null;
};
export const orderStatusNames: Record<OrderStatus, string> = {
  creating: '准备结账',
  pending: '待支付',
  processing: '支付处理中',
  paid: '已支付',
  partially_refunded: '部分退款',
  refunded: '已退款',
  failed: '支付失败',
  expired: '已关闭',
};
export const refundStatusNames: Record<RefundStatus, string> = {
  requested: '正在提交',
  pending: '退款处理中',
  succeeded: '退款成功',
  failed: '退款失败',
  canceled: '已取消',
  requires_action: '需要收款人确认',
};
// Stripe uses two decimal minor units for these currencies despite their display rules.
const stripeTwoDecimal = new Set(['isk', 'ugx']);
export function currencyScale(currency: string) {
  const code = currency.toUpperCase();
  return (
    10 **
    (stripeTwoDecimal.has(currency.toLowerCase())
      ? 2
      : new Intl.NumberFormat('en', {
          style: 'currency',
          currency: code,
        }).resolvedOptions().maximumFractionDigits!)
  );
}
export function money(amount: number | null, currency: string | null) {
  if (amount === null || !currency) return '待确认金额';
  try {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / currencyScale(currency));
  } catch {
    return `${amount} ${currency.toUpperCase()}（最小货币单位）`;
  }
}
