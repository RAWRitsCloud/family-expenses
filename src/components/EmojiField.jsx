import { lazy, Suspense, useState } from "react";

// Lazy-loaded so the (sizeable) emoji dataset is only fetched when a picker is
// actually opened, keeping the initial app bundle small.
const EmojiPicker = lazy(() => import("emoji-picker-react"));

// A small emoji button that opens a searchable picker in a centered modal.
// Rendering the picker in a modal avoids clipping by the editor's overflow-hidden
// containers and works well on mobile. Uses native emoji (no external images).
export default function EmojiField({
  value,
  onSelect,
  size = 38,
  ariaLabel = "Choose emoji",
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn btn-light border bg-white d-inline-flex align-items-center justify-content-center p-0"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.5), lineHeight: 1 }}
        aria-label={ariaLabel}
        onClick={() => setOpen(true)}
      >
        {value || "📌"}
      </button>

      {open && (
        <>
          <div className="modal fade show d-block" tabIndex="-1" role="dialog" style={{ zIndex: 1075 }}>
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content border-0 shadow rounded-4 overflow-hidden">
                <div className="d-flex align-items-center justify-content-between px-3 py-2 border-bottom">
                  <span className="fw-semibold small">Pick an emoji</span>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={() => setOpen(false)}
                  />
                </div>
                <Suspense
                  fallback={<div className="p-4 text-center small text-muted">Loading emojis…</div>}
                >
                  <EmojiPicker
                    onEmojiClick={(emojiData) => {
                      onSelect(emojiData.emoji);
                      setOpen(false);
                    }}
                    emojiStyle="native"
                    width="100%"
                    height="60vh"
                    lazyLoadEmojis
                    previewConfig={{ showPreview: false }}
                  />
                </Suspense>
              </div>
            </div>
          </div>
          <div
            className="modal-backdrop fade show"
            style={{ zIndex: 1070 }}
            onClick={() => setOpen(false)}
          />
        </>
      )}
    </>
  );
}
