export type ToastType = "success" | "error" | "warning";

/** Appends toast params to a redirect target so ToastFromSearchParams can show it after navigation. */
export function withToast(path: string, type: ToastType, message: string): string {
  const url = new URL(path, "http://placeholder.local");
  url.searchParams.set("toastType", type);
  url.searchParams.set("toastMessage", message);
  return `${url.pathname}${url.search}`;
}
