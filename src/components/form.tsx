export const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stm-navy/40 focus:border-transparent";

export const primaryBtnCls =
  "inline-flex items-center justify-center rounded-lg bg-stm-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-stm-navy/90 disabled:opacity-50";

export const secondaryBtnCls =
  "inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50";

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
      <label htmlFor={props.id ?? name} className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input id={props.id ?? name} name={name} required={required} className={inputCls} {...props} />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
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
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
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
