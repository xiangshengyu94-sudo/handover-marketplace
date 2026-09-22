import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { IsoDateInput } from "@/components/forms/iso-date-input";

describe("ISO date input", () => {
  it("uses a stable numeric format instead of the browser-locale date editor", () => {
    const markup = renderToStaticMarkup(
      createElement(IsoDateInput, {
        name: "availableBy",
        defaultValue: "2026-09-05",
      }),
    );

    expect(markup).toContain('type="text"');
    expect(markup).toContain('inputMode="numeric"');
    expect(markup).toContain('placeholder="YYYY-MM-DD"');
    expect(markup).toContain('pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"');
    expect(markup).not.toContain('type="date"');
  });
});
