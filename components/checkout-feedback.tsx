'use client';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, LoaderCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { api } from '@/lib/types';
import { type CommerceOrder, orderStatusNames } from '@/lib/commerce-types';
import { useT } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import { orderStatusEn } from './account';
import '@/app/commerce.css';
export function CheckoutFeedback({
  sessionId,
  refresh,
}: {
  sessionId: string;
  refresh: () => Promise<void>;
}) {
  const t = useT();
  const [order, setOrder] = useState<CommerceOrder | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(true),
    [attempt, setAttempt] = useState(0);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    let cancelled = false,
      timer: ReturnType<typeof setTimeout> | undefined,
      count = 0;
    const poll = async () => {
      setBusy(true);
      try {
        const next = await api<CommerceOrder>('orders/reconcile', {
          sessionId,
        });
        if (cancelled) return;
        setOrder(next);
        setError('');
        if (
          [
            'paid',
            'partially_refunded',
            'refunded',
            'failed',
            'expired',
          ].includes(next.status)
        ) {
          await refreshRef.current();
          setBusy(false);
          return;
        }
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message);
      }
      if (++count < 8)
        timer = setTimeout(
          () => void poll(),
          Math.min(2000 + count * 500, 5000),
        );
      else setBusy(false);
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sessionId, attempt]);
  const successful =
    !!order?.has_access &&
    ['paid', 'partially_refunded'].includes(order.status);
  return (
    <section
      className={`commerce-payment-feedback ${successful ? 'is-complete' : ''}`}
      role="status"
      aria-live="polite"
    >
      {successful ? (
        <CheckCircle2 size={23} />
      ) : busy ? (
        <LoaderCircle className="commerce-spin" size={23} />
      ) : (
        <RefreshCw size={22} />
      )}
      <div>
        <strong>
          {successful
            ? t(
                '付款已确认，课程已开通。',
                'Payment confirmed. Your course is unlocked.',
              )
            : order
              ? t(orderStatusNames[order.status], orderStatusEn[order.status])
              : t('正在确认你的支付结果。', 'Confirming your payment…')}
        </strong>
        <p>
          {successful
            ? t(
                `可以开始学习《${order!.course_title}》了。`,
                `You can now start “${order!.course_title}”.`,
              )
            : error
              ? t(error, englishMessage(error))
              : ['failed', 'expired'].includes(order?.status || '')
                ? t(
                    '这笔订单没有完成支付，你可以重新购买。',
                    "This order wasn't paid. You can buy the course again.",
                  )
                : t(
                    '银行确认可能需要一点时间。确认结果会保存在订单中，无需再次付款。',
                    "Bank confirmation can take a moment. The result is saved to your order, so you don't need to pay again.",
                  )}
        </p>
      </div>
      <div className="form-actions">
        {!busy && !successful && (
          <Button variant="outline" onClick={() => setAttempt((v) => v + 1)}>
            {t('重新确认', 'Check again')}
          </Button>
        )}
        <a className="commerce-link" href="/?view=account">
          {t('查看订单', 'View orders')}
        </a>
      </div>
    </section>
  );
}
