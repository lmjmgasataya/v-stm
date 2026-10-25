export const inputCls =
  "w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm shadow-xs placeholder:text-stone-400 transition focus:outline-none focus:ring-4 focus:ring-stm-brand/15 focus:border-stm-brand";

export const primaryBtnCls =
  "inline-flex items-center justify-center gap-1.5 rounded-full bg-stm-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-stm-brand/30 transition hover:bg-stm-brand-dark active:scale-[0.98] disabled:opacity-50";

export const secondaryBtnCls =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-stone-300 bg-white px-5 py-2.5 text-sm font-semibold text-stone-700 transition hover:border-stone-400 hover:bg-stone-50 active:scale-[0.98] disabled:opacity-50";

export function Field({
  label,
  name,
  required,
  hint,
  ...props
}: {
  label: string;
  name: string;
  required?: boolean;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={props.id ?? name} className="block text-sm font-medium text-stone-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input id={props.id ?? name} name={name} required={required} className={inputCls} {...props} />
      {hint && <p className="text-xs text-stone-400 mt-1">{hint}</p>}
    </div>
  );
}

export function Select({
  label,
  name,
  options,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  options: readonly string[];
  defaultValue?: string | null;
  required?: boolean;
}) {
  // Keep an imported value that isn't in the fixed list selectable when editing
  const allOptions = defaultValue && !options.includes(defaultValue) ? [defaultValue, ...options] : options;
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-stone-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select id={name} name={name} required={required} defaultValue={defaultValue ?? ""} className={inputCls}>
        <option value="" disabled={required}>
          Select…
        </option>
        {allOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{message}</p>;
}
