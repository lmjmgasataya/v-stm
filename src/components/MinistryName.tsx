import { ministryIcon } from "@/lib/constants";

/** A ministry with its icon. The emoji is decorative, so screen readers just read the name. */
export function MinistryName({ ministry }: { ministry: string }) {
  const icon = ministryIcon(ministry);
  return (
    <span className="whitespace-nowrap">
      {icon && <span aria-hidden="true">{icon} </span>}
      {ministry}
    </span>
  );
}
