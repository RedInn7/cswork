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
} from '@/lib/commerce-types';
import '@/app/commerce.css';
export function CommerceAdmin({
  courses,
  refresh,
}: {
  courses: Course[];
  refresh: () => Promise<void>;
}) {
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
              课程售卖
            </h2>
            <p className="muted">
              为课程选择已有的一次性 Stripe
              Price，保存时会核验金额、币种和状态。
            </p>
          </div>
          <span className="tag">
            {configured ? '支付服务已连接' : '支付暂未开放'}
          </span>
        </div>
        {!configured && (
          <p className="commerce-hint">
            当前可以通过学员授权开通课程。连接支付账号、配置课程价格和 Webhook
            后，购买入口才会开放。
          </p>
        )}
        {courses.map((c) => (
          <form
            key={c.id}
            className="commerce-price-row"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await api(`teacher/courses/${encodeURIComponent(c.id)}/price`, {
                  priceId: prices[c.id]?.trim() || null,
                });
                await refresh();
              }, '课程价格已更新。');
            }}
          >
            <div>
              <strong>{c.title}</strong>
              <small>{c.price?.display || '暂未开放购买'}</small>
            </div>
            <label className="sr-only" htmlFor={`price-${c.id}`}>
              {c.title} 的 Stripe Price ID
            </label>
            <Input
              id={`price-${c.id}`}
              value={prices[c.id] || ''}
              placeholder="price_…（留空则关闭购买）"
              onChange={(e) =>
                setPrices((old) => ({ ...old, [c.id]: e.target.value }))
              }
              maxLength={150}
            />
            <Button
              variant="outline"
              disabled={busy || (!!prices[c.id]?.trim() && !configured)}
            >
              保存
            </Button>
          </form>
        ))}
      </section>
      <section className="form-card">
        <div className="commerce-section-heading">
          <div>
            <h2>订单与退款</h2>
            <p className="muted">
              全额退款成功后撤销该笔购买权益；部分退款保留权益。老师直接开通的课程不受影响。
            </p>
          </div>
          <Button
            variant="outline"
            disabled={loading || busy}
            onClick={() => void run(load)}
          >
            <RefreshCw size={14} />
            刷新
          </Button>
        </div>
        <div className="commerce-filters">
          <label>
            <Search size={17} />
            <Input
              aria-label="按邮箱或订单编号搜索"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索学员邮箱 / 订单编号"
            />
          </label>
          <select
            aria-label="筛选订单状态"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">全部状态</option>
            {Object.entries(orderStatusNames).map(([key, label]) => (
              <option value={key} key={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {loading ? (
          <p className="muted">正在读取订单…</p>
        ) : !orders.length ? (
          <div className="commerce-empty">
            {query || status
              ? '没有符合筛选条件的订单。'
              : '还没有课程订单。学员付款后会显示在这里。'}
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
                      {new Date(order.created_at).toLocaleString('zh-CN')}
                    </small>
                  </div>
                  <span
                    className={`commerce-status commerce-status-${order.status}`}
                  >
                    {orderStatusNames[order.status]}
                  </span>
                </div>
                <div className="commerce-order-total">
                  <strong>{money(order.amount, order.currency)}</strong>
                  {order.amount_refunded > 0 && (
                    <small>
                      已退款 {money(order.amount_refunded, order.currency)}
                    </small>
                  )}
                  <small className="commerce-order-id">{order.id}</small>
                </div>
                {order.refunds?.map((r) => (
                  <div className="commerce-refund-row" key={r.id}>
                    <span>
                      {refundStatusNames[r.status]} ·{' '}
                      {money(r.amount, order.currency)}
                      <small>{r.reason}</small>
                    </span>
                    {r.last_error && <small>{r.last_error}</small>}
                  </div>
                ))}
                <div className="form-actions">
                  <Button
                    variant="ghost"
                    disabled={busy || !configured}
                    onClick={() =>
                      void run(async () => {
                        await api(
                          `orders/${encodeURIComponent(order.id)}/refresh`,
                          {},
                        );
                        await load();
                      }, '订单状态已确认。')
                    }
                  >
                    <RefreshCw size={14} />
                    确认状态
                  </Button>
                  {order.receipt_url && (
                    <a
                      className="commerce-link"
                      href={order.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      收据
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
                        发起退款
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
          {error}
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
            <DialogTitle>确认课程退款</DialogTitle>
            <DialogDescription>
              {selected?.course_title} · {selected?.email}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <form
              className="stack-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const scale = currencyScale(selected.currency || 'usd'),
                    raw = Number(refundAmount) * scale,
                    amount = Math.round(raw);
                  if (
                    !Number.isFinite(raw) ||
                    Math.abs(raw - amount) > 0.000001 ||
                    amount <= 0
                  )
                    throw new Error('请输入符合币种精度的退款金额。');
                  if (!confirmed) throw new Error('请先确认退款操作。');
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
                }, '退款请求已提交，请在订单中查看处理进度。');
              }}
            >
              <p className="commerce-hint">
                退款会原路退回学员的支付账户。最多可退{' '}
                {money(
                  (selected.amount || 0) - selected.amount_refunded,
                  selected.currency,
                )}
                ；全额成功退款将撤销该订单的课程权益。
              </p>
              <label>
                退款金额（{selected.currency?.toUpperCase()}）
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
                退款说明
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
                  placeholder="记录退款原因，学员可以看到这条说明。"
                />
              </label>
              <label className="commerce-confirm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                我已核对学员、金额与退款说明，确认发起退款。
              </label>
              {error && (
                <p className="error-text" role="alert">
                  {error}
                </p>
              )}
              <div className="form-actions">
                <Button type="submit" disabled={busy || !confirmed}>
                  {busy ? '正在提交…' : '确认退款'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setSelected(null)}
                >
                  取消
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
