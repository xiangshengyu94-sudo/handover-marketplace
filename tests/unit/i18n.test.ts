import { describe, expect, it } from "vitest";

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  normalizeLocale,
} from "@/lib/i18n/config";
import {
  dictionaries,
  localizeCategories,
  localizeCategoryLabel,
} from "@/lib/i18n/dictionaries";

describe("internationalization contract", () => {
  it("supports English plus the four requested pilot languages", () => {
    expect(SUPPORTED_LOCALES).toEqual(["en", "pl", "it", "de", "es"]);
    expect(DEFAULT_LOCALE).toBe("en");
  });

  it("falls back safely when a cookie contains an unsupported locale", () => {
    expect(normalizeLocale("pl")).toBe("pl");
    expect(normalizeLocale("fr")).toBe("en");
    expect(normalizeLocale(undefined)).toBe("en");
  });

  it("keeps every locale dictionary structurally complete", () => {
    const englishKeys = Object.keys(dictionaries.en).sort();

    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(dictionaries[locale]).sort()).toEqual(englishKeys);
      expect(Object.values(dictionaries[locale]).every(Boolean)).toBe(true);
    }
  });

  it("localizes core navigation and marketplace content", () => {
    expect(dictionaries.en.homeTitle).toBe("Give things another life.");
    expect(dictionaries.en.homeEyebrow).toBe(
      "Pass things on. Pass local knowledge on.",
    );
    expect(dictionaries.en.homeHousingTitle).toBe("Rooms & housing");
    expect(dictionaries.en.homeItemsTitle).toBe("Second-hand things");
    expect(dictionaries.en.homeKnowledgeTitle).toBe("Local knowledge");
    expect(dictionaries.en.filterOther).toBe("Tips & info");
    expect(dictionaries.en.listingCommunityInfo).toBe("Tips & experience");
    expect(dictionaries.pl.navPost).toBe("Dodaj ogłoszenie");
    expect(dictionaries.pl.homeTitle).toBe("Daj rzeczom drugie życie.");
    expect(dictionaries.pl.homeKnowledgeTitle).toBe("Lokalna wiedza");
    expect(dictionaries.it.homeTitle).toBe("Dai alle cose una seconda vita.");
    expect(dictionaries.it.filterOther).toBe("Consigli e informazioni");
    expect(dictionaries.de.homeTitle).toBe("Gib Dingen ein zweites Leben.");
    expect(dictionaries.de.listingCommunityInfo).toBe("Tipps & Erfahrungen");
    expect(dictionaries.es.homeTitle).toBe("Dale una segunda vida a las cosas.");
    expect(dictionaries.es.homeKnowledgeTitle).toBe("Conocimiento local");
    expect(dictionaries.de.authTitle).toBe("Ohne Passwort anmelden.");
    expect(dictionaries.es.listingPublish).toBe("Publicar");
  });

  it("localizes known taxonomy labels and preserves unknown labels", () => {
    expect(localizeCategoryLabel("de", "furniture", "Furniture")).toBe("Möbel");
    expect(localizeCategoryLabel("pl", "other", "Other")).toBe("Inne");
    expect(localizeCategoryLabel("it", "other", "Other")).toBe("Altro");
    expect(localizeCategoryLabel("de", "other", "Other")).toBe("Sonstiges");
    expect(localizeCategoryLabel("es", "other", "Other")).toBe("Otro");
    expect(localizeCategoryLabel("pl", "household", "Household item")).toBe(
      "Przedmiot domowy",
    );
    expect(localizeCategoryLabel("es", "custom", "Custom category")).toBe(
      "Custom category",
    );
    expect(localizeCategories("it", [
      { id: "one", slug: "bicycle", label: "Bicycle", kind: "item" },
    ])).toEqual([
      { id: "one", slug: "bicycle", label: "Bicicletta", kind: "item" },
    ]);
  });
});
