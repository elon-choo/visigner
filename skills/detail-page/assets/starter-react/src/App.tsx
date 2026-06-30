import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from './Button';

// One tokenized, accessible, stateful screen. Every color/space/type value resolves to a token from the
// @theme in index.css — via Tailwind utilities (bg-card / text-muted / shadow-e2 / rounded-lg) or inline
// var(--color-*/--space-*/--text-*) refs (never a --brand-* primitive). State: a quantity stepper with an
// aria-live announcement + a submit flow that cycles idle → loading → reserved, exercising the Button states.
//
// It also ships ONE worked Framer Motion (the `motion` package) example: a grid of plan cards where a card
// MORPHS into a modal via a shared layoutId — the canonical "card → detail" continuity. Motion is GPU-only
// (transform/opacity, never layout) and fully gated by useReducedMotion(): when the user prefers reduced
// motion we DROP the shared-layout transform, skip the hover lift, and collapse every tween to 0 — the modal
// still opens and closes, it just cross-cuts instead of flying. The clickable card carries data-card so the
// skill's shoot harness can film the transition with  MOTION_TRIGGER='[data-card]:click'  (FILMSTRIP=1).

type Status = 'idle' | 'loading' | 'reserved';

const MAX_QTY = 5;
const PRICE = 39000;

type Plan = { id: string; name: string; price: number; blurb: string };
const PLANS: Plan[] = [
  { id: 'lite', name: '라이트', price: 19000, blurb: '혼자 시작하기 좋은 플랜' },
  { id: 'team', name: '팀', price: 49000, blurb: '소규모 팀의 협업까지' },
  { id: 'scale', name: '스케일', price: 99000, blurb: '성장하는 조직을 위한' },
];

export default function App() {
  const [qty, setQty] = useState(1);
  const [status, setStatus] = useState<Status>('idle');
  // Dark toggle: flip <html data-theme="dark"> — the no-flash script in index.html restored it before paint.
  // Every --brand-* neutral re-resolves under [data-theme="dark"] in index.css, so utilities + inline
  // var(--color-*) re-theme with zero per-element edits. Initial state read from the DOM (set pre-paint).
  const [dark, setDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark',
  );
  const toggleTheme = () => {
    const next = dark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('page-theme', next);
    } catch {
      /* private mode — persistence is best-effort */
    }
    setDark(!dark);
  };

  // useReducedMotion() → true when prefers-reduced-motion:reduce. (null until resolved → treated as "animate".)
  const reduceMotion = useReducedMotion();
  const [openId, setOpenId] = useState<string | null>(null);
  const openPlan = PLANS.find((p) => p.id === openId) ?? null;

  // a11y: Escape closes the modal so keyboard users are never trapped. A production build should also focus the
  // modal on open, restore focus to the card on close, and trap Tab within [role=dialog].
  useEffect(() => {
    if (!openPlan) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openPlan]);

  // Reduced motion gates EVERY transform here: drop the shared layoutId, disable layout reflow tweening, and
  // zero the durations so nothing translates/scales — only an instant show/hide remains.
  const sharedId = (id: string) => (reduceMotion ? undefined : `plan-${id}`);
  const layoutMode = reduceMotion ? false : ('position' as const);
  const tween = reduceMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 420, damping: 36 };
  const fade = reduceMotion ? { duration: 0 } : { duration: 0.2 };

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
      <div className="flex items-center justify-between" style={{ gap: 'var(--space-16)' }}>
        <span
          className="inline-block rounded-pill bg-primary-100 text-primary-700 font-body"
          style={{ padding: 'var(--space-8) var(--space-16)', fontSize: 'var(--text-14)' }}
        >
          Vite + React + Tailwind v4
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          aria-pressed={dark}
          aria-label={dark ? '라이트 모드로 전환' : '다크 모드로 전환'}
        >
          {dark ? '☀︎ 라이트' : '☾ 다크'}
        </Button>
      </div>

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

      {/* Motion — a shared-layoutId card→modal. Click a [data-card] to morph it into the dialog; everything is
          token-driven and useReducedMotion()-gated (see the helpers above). */}
      <section aria-labelledby="motion-heading" style={{ marginTop: 'var(--space-48)' }}>
        <h2
          id="motion-heading"
          className="font-display"
          style={{ fontSize: 'var(--text-20)', lineHeight: 'var(--leading-20)', marginBottom: 'var(--space-8)' }}
        >
          모션 — 카드에서 모달로
        </h2>
        <p
          className="text-muted font-body"
          style={{ fontSize: 'var(--text-14)', marginBottom: 'var(--space-16)' }}
        >
          카드를 누르면 같은 <code>layoutId</code> 로 모달과 이어집니다. 시스템에서 ‘동작 줄이기’를 켜면
          변형(transform) 없이 즉시 열립니다. Esc 로 닫을 수 있어요.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 'var(--space-16)',
          }}
        >
          {PLANS.map((plan) => (
            <motion.button
              key={plan.id}
              data-card
              type="button"
              layoutId={sharedId(plan.id)}
              transition={tween}
              onClick={() => setOpenId(plan.id)}
              aria-haspopup="dialog"
              whileHover={reduceMotion ? undefined : { y: -4 }}
              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
              className="bg-card rounded-lg shadow-e1 border border-line text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              style={{ padding: 'var(--space-24)' }}
            >
              <motion.span
                layout={layoutMode}
                className="font-display text-ink block"
                style={{ fontSize: 'var(--text-20)' }}
              >
                {plan.name}
              </motion.span>
              <span
                className="text-muted font-body block"
                style={{ marginTop: 'var(--space-8)', fontSize: 'var(--text-14)' }}
              >
                {plan.blurb}
              </span>
              <span
                className="text-ink font-body block"
                style={{ marginTop: 'var(--space-16)', fontSize: 'var(--text-18)' }}
              >
                ₩{plan.price.toLocaleString('ko-KR')}
                <span className="text-muted" style={{ fontSize: 'var(--text-12)' }}>
                  {' '}
                  /월
                </span>
              </span>
            </motion.button>
          ))}
        </div>

        <AnimatePresence>
          {openPlan && (
            <motion.div
              key="plan-scrim"
              className="fixed inset-0 flex items-center justify-center"
              style={{ background: 'oklch(0 0 0 / 0.45)', padding: 'var(--space-24)', zIndex: 50 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={fade}
              onClick={() => setOpenId(null)}
              role="presentation"
            >
              <motion.div
                layoutId={sharedId(openPlan.id)}
                transition={tween}
                role="dialog"
                aria-modal="true"
                aria-labelledby="plan-modal-title"
                className="bg-card rounded-lg shadow-e3 border border-line"
                style={{ width: 'min(420px, 92vw)', padding: 'var(--space-32)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <motion.h3
                  layout={layoutMode}
                  id="plan-modal-title"
                  className="font-display text-ink"
                  style={{ fontSize: 'var(--text-30)', lineHeight: 'var(--leading-30)' }}
                >
                  {openPlan.name}
                </motion.h3>
                <p
                  className="text-muted font-body"
                  style={{ marginTop: 'var(--space-12)', fontSize: 'var(--text-16)' }}
                >
                  {openPlan.blurb}
                </p>
                <p
                  className="text-ink font-body"
                  style={{ marginTop: 'var(--space-16)', fontSize: 'var(--text-24)' }}
                >
                  ₩{openPlan.price.toLocaleString('ko-KR')}
                  <span className="text-muted" style={{ fontSize: 'var(--text-14)' }}>
                    {' '}
                    /월
                  </span>
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-12)', marginTop: 'var(--space-24)' }}>
                  <Button variant="accent" onClick={() => setOpenId(null)}>
                    선택하기
                  </Button>
                  <Button variant="ghost" onClick={() => setOpenId(null)}>
                    닫기
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </main>
  );
}
