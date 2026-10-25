"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { inputCls } from "@/components/form";
import type { VglOption } from "@/lib/vgl";

const MAX_SUGGESTIONS = 8;

/**
 * VGL picker backed by v-1's victory group leaders. Picking a suggestion posts its id as
 * `vglId`; typing a name that isn't picked posts just `vglName` (kept as free text, for
 * leaders not in v-1). resolveVgl settles the two on the server.
 */
export function VglAutocomplete({
  options,
  defaultId,
  defaultName,
}: {
  options: VglOption[];
  defaultId?: number | null;
  defaultName?: string | null;
}) {
  const [text, setText] = useState(defaultName ?? "");
  const [selectedId, setSelectedId] = useState<number | null>(defaultId ?? null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // form.reset() (e.g. after "Save & add another") restores inputs but not React state
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const onReset = () => {
      setText(defaultName ?? "");
      setSelectedId(defaultId ?? null);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [defaultId, defaultName]);

  const suggestions = useMemo(() => {
    const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];
    return options
      .filter((o) => {
        const haystack = `${o.name} ${o.detail}`.toLowerCase();
        return tokens.every((t) => haystack.includes(t));
      })
      .slice(0, MAX_SUGGESTIONS);
  }, [options, text]);

  function choose(option: VglOption) {
    setText(option.name);
    setSelectedId(option.id);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      // Pick the suggestion instead of submitting the form
      e.preventDefault();
      choose(suggestions[highlight] ?? suggestions[0]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <label htmlFor="vglName" className="block text-sm font-medium text-stone-700 mb-1">
        VGL (Victory Group Leader)
      </label>
      <input
        ref={inputRef}
        id="vglName"
        name="vglName"
        value={text}
        autoComplete="off"
        placeholder="Start typing a name…"
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-controls="vgl-suggestions"
        aria-autocomplete="list"
        onChange={(e) => {
          setText(e.target.value);
          setSelectedId(null);
          setHighlight(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // Delay so a click on a suggestion lands before the list closes
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        className={inputCls}
      />
      <input type="hidden" name="vglId" value={selectedId ?? ""} />

      {open && suggestions.length > 0 && (
        <ul
          id="vgl-suggestions"
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-lg"
        >
          {suggestions.map((option, i) => (
            <li
              key={option.id}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(option)}
              onMouseEnter={() => setHighlight(i)}
              className={`cursor-pointer px-3 py-2 text-sm ${i === highlight ? "bg-stm-brand/10" : ""}`}
            >
              <p className="font-medium text-stone-900">{option.name}</p>
              {option.detail && <p className="text-xs text-stone-500">{option.detail}</p>}
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs mt-1">
        {selectedId !== null ? (
          <span className="text-stm-green">✓ Linked to VGL list</span>
        ) : text.trim() ? (
          <span className="text-stm-amber">Not picked from the VGL list — will be saved as typed.</span>
        ) : (
          <span className="text-stone-400">Pick from v-1&apos;s VGL list, or type a name.</span>
        )}
      </p>
    </div>
  );
}
