type ConfirmDialogProps = {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#3e2723]/45 p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
      >
        <h2 id="confirm-title" className="text-base font-bold text-[#3e2723]">
          {title}
        </h2>
        <p className="mt-1.5 text-sm leading-snug text-[#3e2723]/65">{body}</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-full border border-[#3e2723]/15 px-4 py-2.5 text-sm font-semibold text-[#3e2723] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${
              danger
                ? "bg-[#d81b60] text-white"
                : "bg-[#2aa7ad] text-white"
            }`}
          >
            {busy ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
