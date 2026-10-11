import { lazy, Suspense, useState } from "react";
import Sheet from "./Sheet";

// Lazy-loaded so the (sizeable) emoji dataset is only fetched when a picker is
// actually opened, keeping the initial app bundle small.
const EmojiPicker = lazy(() => import("emoji-picker-react"));

// A small emoji button that opens a searchable picker in a bottom sheet (phones)
// or centred dialog.
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
        <Sheet title="Pick an emoji" width={720} zIndex={1075} onClose={() => setOpen(false)}>
          {({ close }) => (
            <Suspense
              fallback={<div className="p-4 text-center small text-muted">Loading emojis…</div>}
            >
              <EmojiPicker
                onEmojiClick={(emojiData) => {
                  onSelect(emojiData.emoji);
                  close();
                }}
                emojiStyle="native"
                width="100%"
                height="min(60dvh, 460px)"
                lazyLoadEmojis
                previewConfig={{ showPreview: false }}
              />
            </Suspense>
          )}
        </Sheet>
      )}
    </>
  );
}
