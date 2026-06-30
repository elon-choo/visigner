import { useState } from 'react';
import { Button } from './Button';

// One tokenized, accessible, stateful screen. Every color/space/type value resolves to a token from the
// @theme in index.css — via Tailwind utilities (bg-card / text-muted / shadow-e2 / rounded-lg) or inline
// var(--color-*/--space-*/--text-*) refs (never a --brand-* primitive). State: a quantity stepper with an
// aria-live announcement + a submit flow that cycles idle → loading → reserved, exercising the Button states.

type Status = 'idle' | 'loading' | 'reserved';

const MAX_QTY = 5;
const PRICE = 39000;

export default function App() {
  const [qty, setQty] = useState(1);
  const [status, setStatus] = useState<Status>('idle');

  const dec = () => setQty((q) => Math.max(1, q - 1));
  const inc = () => setQty((q) => Math.min(MAX_QTY, q + 1));

  const reserve = () => {
    if (status === 'loading') return;
    setStatus('loading');
    // Demo async — replace with your real reservation call.
    window.setTimeout(() => setStatus('reserved'), 1200);
  };

  const total = (PRICE * qty).toLocaleString('ko-KR');

  return (
    <main
      className="mx-auto"
      style={{ maxWidth: '720px', padding: 'var(--space-48) var(--space-24)' }}
    >
      <span
        className="inline-block rounded-pill bg-primary-100 text-primary-700 font-body"
        style={{ padding: 'var(--space-8) var(--space-16)', fontSize: 'var(--text-14)' }}
      >
        Vite + React + Tailwind v4
      </span>

      <h1
        className="font-display"
        style={{
          fontSize: 'var(--text-48)',
          lineHeight: 'var(--leading-48)',
          margin: 'var(--space-24) 0 var(--space-16)',
        }}
      >
        토큰 한 곳에서 나오는 디자인
      </h1>
      <p
        className="text-muted font-body"
        style={{ fontSize: 'var(--text-18)', lineHeight: 'var(--leading-18)', maxWidth: '52ch' }}
      >
        이 화면의 모든 색·타이포·그림자·간격은{' '}
        <code>tokens/brand-default.tokens.json</code> 한 곳에서 컴파일됩니다. 아래 카드는 접근성과
        상태(state)를 갖춘 실제 인터랙션입니다.
      </p>

      {/* Reservation card — the stateful, accessible interaction */}
      <section
        aria-labelledby="reserve-heading"
        className="bg-card rounded-lg shadow-e2 border border-line"
        style={{ marginTop: 'var(--space-32)', padding: 'var(--space-24)' }}
      >
        <h2
          id="reserve-heading"
          className="font-display"
          style={{ fontSize: 'var(--text-24)', lineHeight: 'var(--leading-24)' }}
        >
          얼리버드 예약
        </h2>

        <div
          className="flex items-center justify-between"
          style={{ marginTop: 'var(--space-24)' }}
        >
          <span id="qty-label" className="font-body" style={{ fontSize: 'var(--text-16)' }}>
            수량
          </span>
          <div
            className="inline-flex items-center rounded-md border border-line"
            role="group"
            aria-labelledby="qty-label"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={dec}
              disabled={qty <= 1}
              aria-label="수량 줄이기"
              className="rounded-none border-0"
            >
              −
            </Button>
            <span
              aria-live="polite"
              aria-atomic="true"
              className="text-ink font-body text-center"
              style={{ minWidth: 'var(--space-48)', fontSize: 'var(--text-18)' }}
            >
              {qty}
              <span className="sr-only"> 개 선택됨</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={inc}
              disabled={qty >= MAX_QTY}
              aria-label="수량 늘리기"
              className="rounded-none border-0"
            >
              +
            </Button>
          </div>
        </div>

        <p
          className="text-muted font-body"
          style={{ marginTop: 'var(--space-16)', fontSize: 'var(--text-14)' }}
        >
          합계{' '}
          <strong className="text-ink" style={{ fontSize: 'var(--text-18)' }}>
            ₩{total}
          </strong>
        </p>

        <div style={{ marginTop: 'var(--space-24)' }}>
          <Button
            variant="accent"
            onClick={reserve}
            loading={status === 'loading'}
            disabled={status === 'reserved'}
            className="w-full"
          >
            {status === 'reserved' ? '예약 완료' : status === 'loading' ? '예약 처리 중' : '지금 예약하기'}
          </Button>
        </div>

        {/* Status is announced politely for screen readers without stealing focus. */}
        <p
          role="status"
          aria-live="polite"
          className="text-muted font-body"
          style={{ marginTop: 'var(--space-12)', fontSize: 'var(--text-12)', minHeight: 'var(--space-16)' }}
        >
          {status === 'reserved' ? '예약이 접수되었습니다. 확인 메일을 보냈어요.' : ''}
        </p>
      </section>

      {/* Button state gallery — proves every interaction state renders from tokens. */}
      <section
        aria-labelledby="states-heading"
        style={{ marginTop: 'var(--space-48)' }}
      >
        <h2
          id="states-heading"
          className="font-display"
          style={{ fontSize: 'var(--text-20)', lineHeight: 'var(--leading-20)', marginBottom: 'var(--space-16)' }}
        >
          Button — 전체 상태
        </h2>
        <p
          className="text-muted font-body"
          style={{ fontSize: 'var(--text-14)', marginBottom: 'var(--space-16)' }}
        >
          default · hover · focus(키보드 Tab) · active(누르는 중) 는 CSS 의사상태로, 아래 버튼 하나에서 모두
          확인됩니다. disabled · loading 은 별도 인스턴스로 표시했습니다.
        </p>
        <div className="flex flex-wrap items-center" style={{ gap: 'var(--space-12)' }}>
          <Button variant="primary">Primary</Button>
          <Button variant="accent">Accent</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button variant="accent" loading>
            Loading
          </Button>
        </div>
      </section>
    </main>
  );
}
