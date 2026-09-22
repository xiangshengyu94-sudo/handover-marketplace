"use client";

import { useState } from "react";

import { LOCALE_OPTIONS, type Locale } from "@/lib/i18n/config";

export function LanguageSwitcher({ locale, label }: { locale: Locale; label: string }) {
  const [selected, setSelected] = useState(locale);
  const [pending, setPending] = useState(false);

  return (
    <label className="language-switcher">
      <span>{label}</span>
      <select
        aria-label={label}
        data-testid="language-switcher"
        disabled={pending}
        value={selected}
        onChange={(event) => {
          const nextLocale = event.target.value as Locale;
          setSelected(nextLocale);
          setPending(true);
          void fetch("/api/locale", {
            body: JSON.stringify({ locale: nextLocale }),
            headers: { "content-type": "application/json" },
            method: "POST",
          }).then((response) => {
            if (!response.ok) throw new Error("Unable to change language.");
            window.location.reload();
          }).catch(() => {
            setSelected(locale);
            setPending(false);
          });
        }}
      >
        {LOCALE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
