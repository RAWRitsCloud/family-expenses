import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Spring parameters, expressed the way Apple does: damping ratio + response.
// damping 1 = critically damped (no overshoot); response = seconds to reach target.
const SPRING_DEFAULT = { damping: 1, response: 0.38 };
const SPRING_MOMENTUM = { damping: 0.8, response: 0.38 };

// Desktop dialogs animate a 0..DIALOG_TRAVEL "hidden amount" that maps to
// opacity + a small scale, so the same spring code drives both layouts.
const DIALOG_TRAVEL = 40;

const isPhone = () => window.matchMedia("(max-width: 575.98px)").matches;
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Where a flick would come to rest (Apple's deceleration projection).
function project(velocity, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

// Progressive resistance past an edge.
function rubberband(overshoot, dimension, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

// Calls a render-prop child from its own component so it is not invoked in Sheet's render.
function Slot({ render, close }) {
  return render({ close });
}

// A bottom sheet on phones, a centred dialog elsewhere. Rendered through a
// portal so it is never clipped by overflow containers.
//
// - Springs animate from the *current* on-screen value, so grabbing mid-flight
//   (or tapping close mid-entry) never jumps.
// - Phones: drag the header down to dismiss; release velocity is projected and
//   handed to the spring. Dragging up rubber-bands.
// - Enters from, and exits to, the same edge.
// - Honors prefers-reduced-motion (cross-fade only, no drag).
//
// `children` may be a function receiving `{ close }`, which animates out then
// calls `onClose`.
export default function Sheet({
  title,
  onClose,
  children,
  width = 500,
  zIndex = 1060,
  closeLabel = "Close",
}) {
    const panelRef = useRef(null);
  const scrimRef = useRef(null);
  // Layout + motion preference are fixed for the lifetime of the sheet.
  const [mode] = useState(() => ({ phone: isPhone(), reduced: prefersReducedMotion() }));
  const modeRef = useRef(mode);
  const valueRef = useRef(0); // current offset (px on phones, 0..DIALOG_TRAVEL on dialogs)
  const velocityRef = useRef(0);
  const rafRef = useRef(0);
  const closingRef = useRef(false);
  const dragRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const extent = useCallback(() => {
    const panel = panelRef.current;
    return mode.phone ? (panel ? panel.offsetHeight : 400) : DIALOG_TRAVEL;
  }, [mode]);

  // Write the value straight to the DOM — no React re-render per frame.
  const apply = useCallback((value) => {
    valueRef.current = value;
    const panel = panelRef.current;
    const scrim = scrimRef.current;
    if (!panel || !scrim || !modeRef.current) return;
    const total = extent();
    const hidden = Math.min(Math.max(value / total, 0), 1);
    if (modeRef.current.phone) {
      panel.style.transform = `translate3d(0, ${value}px, 0)`;
    } else {
      panel.style.transform = `scale(${1 - 0.04 * hidden})`;
      panel.style.opacity = String(1 - hidden);
    }
    scrim.style.opacity = String(1 - hidden);
  }, [extent]);

  const stop = () => cancelAnimationFrame(rafRef.current);

  // Integrate a damped spring toward `target` from the current value and velocity.
  const springTo = useCallback(
    (target, { velocity = 0, damping, response } = SPRING_DEFAULT, onDone) => {
      stop();
      const omega = (2 * Math.PI) / response;
      const k = omega * omega;
      const c = 2 * damping * omega;
      let x = valueRef.current;
      let v = velocity;
      let last = performance.now();
      const step = (now) => {
        let dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        while (dt > 0) {
          const h = Math.min(dt, 1 / 240);
          v += (-k * (x - target) - c * v) * h;
          x += v * h;
          dt -= h;
        }
        velocityRef.current = v;
        if (Math.abs(x - target) < 0.4 && Math.abs(v) < 8) {
          apply(target);
          velocityRef.current = 0;
          onDone?.();
          return;
        }
        apply(x);
        rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [apply]
  );

  const close = useCallback(
    (velocity = 0) => {
      if (typeof velocity !== "number") velocity = 0; // called as an event handler
      if (closingRef.current) return;
      closingRef.current = true;
      if (modeRef.current.reduced) {
        onCloseRef.current?.();
        return;
      }
      // Exit along the path we entered by.
      springTo(extent() + (modeRef.current.phone ? 24 : 0), { ...SPRING_DEFAULT, velocity }, () =>
        onCloseRef.current?.()
      );
    },
    [springTo, extent]
  );

  // Mount: pick layout, enter, lock scroll, manage focus.
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    if (modeRef.current.reduced) {
      apply(0);
    } else {
      apply(extent());
      springTo(0, SPRING_DEFAULT);
    }
    panelRef.current?.focus({ preventScroll: true });

    return () => {
      stop();
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [apply, springTo, extent]);

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== "Tab") return;
    const focusable = panelRef.current.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusable[0];
    const lastEl = focusable[focusable.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
      e.preventDefault();
      lastEl.focus();
    } else if (!e.shiftKey && document.activeElement === lastEl) {
      e.preventDefault();
      first.focus();
    }
  };

  // --- Drag to dismiss (phones) ---
  const canDrag = () => modeRef.current?.phone && !modeRef.current.reduced && !closingRef.current;

  const onPointerDown = (e) => {
    if (!canDrag() || (e.pointerType === "mouse" && e.button !== 0)) return;
    if (e.target.closest("button, a, input, select, textarea")) return;
    stop(); // grab it mid-flight
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startY: e.clientY,
      startValue: valueRef.current, // keep the offset from where it was grabbed
      samples: [{ t: performance.now(), y: e.clientY }],
    };
  };

  const onPointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    const now = performance.now();
    drag.samples.push({ t: now, y: e.clientY });
    while (drag.samples.length > 2 && now - drag.samples[0].t > 100) drag.samples.shift();
    const raw = drag.startValue + (e.clientY - drag.startY);
    // Pulling up past fully-open resists; pulling down tracks 1:1.
    apply(raw < 0 ? -rubberband(-raw, extent()) : raw);
  };

  const onPointerEnd = () => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    const first = drag.samples[0];
    const lastSample = drag.samples[drag.samples.length - 1];
    const dt = Math.max(lastSample.t - first.t, 1);
    const velocity = ((lastSample.y - first.y) / dt) * 1000; // px/s, + is down

    const resting = valueRef.current + project(velocity);
    if (resting > extent() * 0.5) {
      close(velocity);
    } else {
      // Only bounce if the release carried momentum.
      const spring = Math.abs(velocity) > 300 ? SPRING_MOMENTUM : SPRING_DEFAULT;
      springTo(0, { ...spring, velocity });
    }
  };

  return createPortal(
    <div className="sheet-root" style={{ zIndex }} onKeyDown={onKeyDown}>
      <div ref={scrimRef} className="sheet-scrim" onClick={() => close()} />
      <div
        ref={panelRef}
        className={`sheet-panel${mode.reduced ? " is-reduced" : ""}`}
        style={{ "--sheet-width": `${width}px` }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div
          className="sheet-drag-zone"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        >
          <div className="sheet-grabber" aria-hidden="true" />
          <div className="d-flex align-items-center justify-content-between px-3 pt-2 pb-2">
            <h2 className="h6 fw-bold mb-0">{title}</h2>
            <button type="button" className="btn-close" aria-label={closeLabel} onClick={() => close()} />
          </div>
        </div>
        <div className="sheet-body">
          {typeof children === "function" ? <Slot render={children} close={close} /> : children}
        </div>
      </div>
    </div>,
    document.body
  );
}
