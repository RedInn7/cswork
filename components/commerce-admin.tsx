'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  CreditCard,
  Search,
  RefreshCw,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { api, type Course } from '@/lib/types';
import {
  money,
  currencyScale,
  orderStatusNames,
  refundStatusNames,
  type CommerceOrder,
  type OrderStatus,
  type RefundStatus,
} from '@/lib/commerce-types';
import { useLocale, useT } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import '@/app/commerce.css';
// English labels for the shared (Chinese) status maps in lib/commerce-types.
const orderStatusEn: Record<OrderStatus, string> = {
  creating: 'Preparing checkout',
  pending: 'Awaiting payment',
  processing: 'Processing payment',
  paid: 'Paid',
  partially_refunded: 'Partially refunded',
  refunded: 'Refunded',
  failed: 'Payment failed',
  expired: 'Closed',
};
const refundStatusEn: Record<RefundStatus, string> = {
  requested: 'Submitting',
  pending: 'Refund pending',
  succeeded: 'Refunded',
  failed: 'Refund failed',
  canceled: 'Cancelled',
  requires_action: 'Needs recipient confirmation',
};
export function CommerceAdmin({
  courses,
  refresh,
}: {
  courses: Course[];
  refresh: () => Promise<void>;
}) {
  const t = useT(),
    locale = useLocale();
  const [orders, setOrders] = useState<CommerceOrder[]>([]),
    [configured, setConfigured] = useState(false),
    [query, setQuery] = useState(''),
    [status, setStatus] = useState(''),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [prices, setPrices] = useState<Record<string, string>>({}),
    [selected, setSelected] = useState<CommerceOrder | null>(null),
    [refundAmount, setRefundAmount] = useState(''),
    [reason, setReason] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [operationId, setOperationId] = useState('');
  useEffect(
    () =>
      setPrices(
        Object.fromEntries(courses.map((c) => [c.id, c.price_id || ''])),
      ),
    [courses],
  );
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{
        orders: CommerceOrder[];
        configured: boolean;
      }>('teacher/orders?' + new URLSearchParams({ q: query, status }));
      setOrders(result.orders);
      setConfigured(result.configured);
    } finally {
      setLoading(false);
    }
  }, [query, status]);
  useEffect(() => {
    const timer = setTimeout(
      () => void load().catch((e) => setError(e.message)),
      250,
    );
    return () => clearTimeout(timer);
  }, [load]);
  async function run(fn: () => Promise<void>, success = '') {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
      setMessage(success);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function refund(order: CommerceOrder) {
    setSelected(order);
    setRefundAmount(
      String(
        ((order.amount || 0) - order.amount_refunded) /
          currencyScale(order.currency || 'usd'),
      ),
    );
    setReason('');
    setConfirmed(false);
    setOperationId(crypto.randomUUID());
    setError('');
  }
  return (
    <div className="commerce-admin">
      <section className="form-card">
        <div className="commerce-section-heading">
          <div>
            <h2>
              <CreditCard size={20} />
              {t('课程售卖', 'Course sales')}
            </h2>
            <p className="muted">
              {t(
                '为课程选择已有的一次性 Stripe Price，保存时会核验金额、币种和状态。',
                'Pick an existing one-time Stripe Price for each course. Saving verifies its amount, currency and status.',
              )}
            </p>
          </div>
          <span className="tag">
            {configured
              ? t('支付服务已连接', 'Payments connected')
              : t('支付暂未开放', 'Payments not available yet')}
          </span>
        </div>
        {!configured && (
          <p className="commerce-hint">
            {t(
              '当前可以通过学员授权开通课程。连接支付账号、配置课程价格和 Webhook 后，购买入口才会开放。',
              'For now, courses are unlocked by granting student access. Purchases open once the payment account, course prices and webhook are set up.',
            )}
          </p>
        )}
        {courses.map((c) => (
          <form
            key={c.id}
            className="commerce-price-row"
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                async () => {
                  await api(
                    `teacher/courses/${encodeURIComponent(c.id)}/price`,
                    {
                      priceId: prices[c.id]?.trim() || null,
                    },
                  );
                  await refresh();
                },
                t('课程价格已更新。', 'Course price updated.'),
              );
            }}
          >
            <div>
              <strong>{c.title}</strong>
              <small>
                {c.price
                  ? money(c.price.amount, c.price.currency, locale)
                  : t('暂未开放购买', 'Not for sale yet')}
              </small>
            </div>
            <label className="sr-only" htmlFor={`price-${c.id}`}>
              {t(
                `${c.title} 的 Stripe Price ID`,
                `Stripe Price ID for ${c.title}`,
              )}
            </label>
            <Input
              id={`price-${c.id}`}
              value={prices[c.id] || ''}
              placeholder={t(
                'price_…（留空则关闭购买）',
                'price_… (leave blank to stop sales)',
              )}
              onChange={(e) =>
                setPrices((old) => ({ ...old, [c.id]: e.target.value }))
              }
              maxLength={150}
            />
            <Button
              variant="outline"
              disabled={busy || (!!prices[c.id]?.trim() && !configured)}
            >
              {t('保存', 'Save')}
            </Button>
          </form>
        ))}
      </section>
      <section className="form-card">
        <div className="commerce-section-heading">
          <div>
            <h2>{t('订单与退款', 'Orders and refunds')}</h2>
            <p className="muted">
              {t(
                '全额退款成功后撤销该笔购买权益；部分退款保留权益。老师直接开通的课程不受影响。',
                'A successful full refund revokes the purchased access; partial refunds keep it. Courses granted directly by a teacher are not affected.',
              )}
            </p>
          </div>
          <Button
            variant="outline"
            disabled={loading || busy}
            onClick={() => void run(load)}
          >
            <RefreshCw size={14} />
            {t('刷新', 'Refresh')}
          </Button>
        </div>
        <div className="commerce-filters">
          <label>
            <Search size={17} />
            <Input
              aria-label={t(
                '按邮箱或订单编号搜索',
                'Search by email or order ID',
              )}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t(
                '搜索学员邮箱 / 订单编号',
                'Search student email / order ID',
              )}
            />
          </label>
          <select
            aria-label={t('筛选订单状态', 'Filter by order status')}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">{t('全部状态', 'All statuses')}</option>
            {Object.entries(orderStatusNames).map(([key, label]) => (
              <option value={key} key={key}>
                {t(label, orderStatusEn[key as OrderStatus])}
              </option>
            ))}
          </select>
        </div>
        {loading ? (
          <p className="muted">{t('正在读取订单…', 'Loading orders…')}</p>
        ) : !orders.length ? (
          <div className="commerce-empty">
            {query || status
              ? t('没有符合筛选条件的订单。', 'No orders match these filters.')
              : t(
                  '还没有课程订单。学员付款后会显示在这里。',
                  'No course orders yet. They show up here once students pay.',
                )}
          </div>
        ) : (
          <div className="commerce-admin-orders">
            {orders.map((order) => (
              <article className="commerce-admin-order" key={order.id}>
                <div className="commerce-section-heading">
                  <div>
                    <strong>{order.course_title}</strong>
                    <small>
                      {order.email} ·{' '}
                      {new Date(order.created_at).toLocaleString(
                        locale === 'zh' ? 'zh-CN' : 'en-US',
                      )}
                    </small>
                  </div>
                  <span
                    className={`commerce-status commerce-status-${order.status}`}
                  >
                    {t(
                      orderStatusNames[order.status],
                      orderStatusEn[order.status],
                    )}
                  </span>
                </div>
                <div className="commerce-order-total">
                  <strong>{money(order.amount, order.currency, locale)}</strong>
                  {order.amount_refunded > 0 && (
                    <small>
                      {t('已退款', 'Refunded')}{' '}
                      {money(order.amount_refunded, order.currency, locale)}
                    </small>
                  )}
                  <small className="commerce-order-id">{order.id}</small>
                </div>
                {order.refunds?.map((r) => (
                  <div className="commerce-refund-row" key={r.id}>
                    <span>
                      {t(refundStatusNames[r.status], refundStatusEn[r.status])}{' '}
                      · {money(r.amount, order.currency, locale)}
                      <small>{t(r.reason, englishMessage(r.reason))}</small>
                    </span>
                    {r.last_error && (
                      <small>
                        {t(r.last_error, englishMessage(r.last_error))}
                      </small>
                    )}
                  </div>
                ))}
                <div className="form-actions">
                  <Button
                    variant="ghost"
                    disabled={busy || !configured}
                    onClick={() =>
                      void run(
                        async () => {
                          await api(
                            `orders/${encodeURIComponent(order.id)}/refresh`,
                            {},
                          );
                          await load();
                        },
                        t('订单状态已确认。', 'Order status confirmed.'),
                      )
                    }
                  >
                    <RefreshCw size={14} />
                    {t('确认状态', 'Check status')}
                  </Button>
                  {order.receipt_url && (
                    <a
                      className="commerce-link"
                      href={order.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t('收据', 'Receipt')}
                      <ExternalLink size={14} />
                    </a>
                  )}
                  {['paid', 'partially_refunded'].includes(order.status) &&
                    (order.amount || 0) > order.amount_refunded && (
                      <Button
                        variant="outline"
                        disabled={busy || !configured}
                        onClick={() => refund(order)}
                      >
                        <RotateCcw size={14} />
                        {t('发起退款', 'Issue refund')}
                      </Button>
                    )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {message && (
        <p className="notice commerce-success" role="status">
          {message}
        </p>
      )}
      {error && !selected && (
        <p className="notice error" role="alert">
          {t(error, englishMessage(error))}
        </p>
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !busy) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('确认课程退款', 'Confirm course refund')}
            </DialogTitle>
            <DialogDescription>
              {selected?.course_title} · {selected?.email}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <form
              className="stack-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run(
                  async () => {
                    const scale = currencyScale(selected.currency || 'usd'),
                      raw = Number(refundAmount) * scale,
                      amount = Math.round(raw);
                    if (
                      !Number.isFinite(raw) ||
                      Math.abs(raw - amount) > 0.000001 ||
                      amount <= 0
                    )
                      throw new Error(
                        t(
                          '请输入符合币种精度的退款金额。',
                          'Enter a refund amount with a valid precision for this currency.',
                        ),
                      );
                    if (!confirmed)
                      throw new Error(
                        t(
                          '请先确认退款操作。',
                          'Please confirm the refund first.',
                        ),
                      );
                    await api(
                      `teacher/orders/${encodeURIComponent(selected.id)}/refund`,
                      {
                        amount,
                        reason: reason.trim(),
                        idempotencyKey: operationId,
                      },
                    );
                    setSelected(null);
                    await load();
                    await refresh();
                  },
                  t(
                    '退款请求已提交，请在订单中查看处理进度。',
                    'Refund requested. Track its progress on the order.',
                  ),
                );
              }}
            >
              <p className="commerce-hint">
                {t(
                  '退款会原路退回学员的支付账户。最多可退',
                  "Refunds go back to the student's original payment method. Up to",
                )}{' '}
                {money(
                  (selected.amount || 0) - selected.amount_refunded,
                  selected.currency,
                  locale,
                )}
                {t(
                  '；全额成功退款将撤销该订单的课程权益。',
                  " can be refunded; a successful full refund revokes this order's course access.",
                )}
              </p>
              <label>
                {t(
                  `退款金额（${selected.currency?.toUpperCase() ?? ''}）`,
                  `Refund amount (${selected.currency?.toUpperCase() ?? ''})`,
                )}
                <Input
                  type="number"
                  inputMode="decimal"
                  min={1 / currencyScale(selected.currency || 'usd')}
                  step={1 / currencyScale(selected.currency || 'usd')}
                  max={
                    ((selected.amount || 0) - selected.amount_refunded) /
                    currencyScale(selected.currency || 'usd')
                  }
                  value={refundAmount}
                  required
                  onChange={(e) => {
                    setRefundAmount(e.target.value);
                    setOperationId(crypto.randomUUID());
                    setConfirmed(false);
                  }}
                />
              </label>
              <label>
                {t('退款说明', 'Refund reason')}
                <textarea
                  rows={3}
                  required
                  minLength={2}
                  maxLength={1000}
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setOperationId(crypto.randomUUID());
                    setConfirmed(false);
                  }}
                  placeholder={t(
                    '记录退款原因，学员可以看到这条说明。',
                    'Note the reason for the refund. The student can see it.',
                  )}
                />
              </label>
              <label className="commerce-confirm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                {t(
                  '我已核对学员、金额与退款说明，确认发起退款。',
                  'I have checked the student, amount and reason, and want to issue this refund.',
                )}
              </label>
              {error && (
                <p className="error-text" role="alert">
                  {t(error, englishMessage(error))}
                </p>
              )}
              <div className="form-actions">
                <Button type="submit" disabled={busy || !confirmed}>
                  {busy
                    ? t('正在提交…', 'Submitting…')
                    : t('确认退款', 'Confirm refund')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setSelected(null)}
                >
                  {t('取消', 'Cancel')}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
