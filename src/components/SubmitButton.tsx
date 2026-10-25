"use client";

import { useFormStatus } from "react-dom";

interface Props {
  label: string;
  pendingLabel?: string;
  className?: string;
  icon?: string;
}

export function SubmitButton({ label, pendingLabel, className, icon }: Props) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      <span className="flex items-center justify-center gap-2">
        {pending ? (
          <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        ) : (
          icon && <span className="text-base leading-none">{icon}</span>
        )}
        {pending ? (pendingLabel ?? label) : label}
      </span>
    </button>
  );
}
