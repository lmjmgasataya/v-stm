// Pieces shared by the service check-in and event check-in screens.

export interface SearchableMember {
  firstName: string;
  lastName: string;
  middleInitial: string;
  nickname: string | null;
  mobileNumber: string;
  vglName: string | null;
}

/** Every typed word must appear in the member's name, nickname, mobile or VGL. */
export function matchesMember(member: SearchableMember, tokens: string[]) {
  const haystack =
    `${member.firstName} ${member.nickname ?? ""} ${member.lastName} ${member.middleInitial} ${member.mobileNumber} ${member.vglName ?? ""}`.toLowerCase();
  return tokens.every((t) => haystack.includes(t));
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
        active ? "bg-stm-brand text-white" : "bg-white text-stone-600 ring-1 ring-stone-200 hover:ring-stm-brand/40 hover:text-stm-brand"
      }`}
    >
      {children}
    </button>
  );
}
