import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const ToastContext = createContext(null);

const LEAVE_MS = 200;

// One toast at a time. `showToast({ message, actionLabel, onAction, duration })`.
// Used for forgiving destructive actions: delete now, offer Undo.
// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const autoTimer = useRef(0);
  const removeTimer = useRef(0);

  const dismiss = useCallback(() => {
    clearTimeout(autoTimer.current);
    clearTimeout(removeTimer.current);
    setLeaving(true);
    removeTimer.current = setTimeout(() => {
      setToast(null);
      setLeaving(false);
    }, LEAVE_MS);
  }, []);

  const showToast = useCallback(
    (next) => {
      clearTimeout(autoTimer.current);
      clearTimeout(removeTimer.current);
      setLeaving(false);
      setToast({ id: Date.now() + Math.random(), ...next });
      autoTimer.current = setTimeout(dismiss, next.duration ?? 6000);
    },
    [dismiss]
  );

  useEffect(
    () => () => {
      clearTimeout(autoTimer.current);
      clearTimeout(removeTimer.current);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ showToast, dismissToast: dismiss }}>
      {children}
      {toast && (
        <div className="toast-host">
          <div
            key={toast.id}
            className={`toast-pill${leaving ? " is-leaving" : ""}`}
            role="status"
            aria-live="polite"
          >
            <span className="flex-grow-1 small fw-semibold py-2">{toast.message}</span>
            {toast.actionLabel && (
              <button
                type="button"
                className="btn btn-sm btn-link fw-bold text-decoration-none px-3"
                style={{ color: "#6ea8fe", minHeight: 44 }}
                onClick={() => {
                  toast.onAction?.();
                  dismiss();
                }}
              >
                {toast.actionLabel}
              </button>
            )}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}
