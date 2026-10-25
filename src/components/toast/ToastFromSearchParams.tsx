"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useToast, type ToastType } from "./ToastContext";

const VALID_TYPES: ToastType[] = ["success", "error", "warning"];

export function ToastFromSearchParams() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useToast();

  useEffect(() => {
    const type = searchParams.get("toastType");
    const message = searchParams.get("toastMessage");
    if (!message || !VALID_TYPES.includes(type as ToastType)) return;

    showToast(type as ToastType, message);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("toastType");
    params.delete("toastMessage");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    // Only re-run when the URL's search params change — showToast/router/pathname
    // are stable enough per navigation that including them would refire this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return null;
}
