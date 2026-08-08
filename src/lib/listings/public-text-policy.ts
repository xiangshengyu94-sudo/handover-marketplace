export type PublicTextField =
  | "title"
  | "description"
  | "approximateArea"
  | "pickupArea";

export type PublicTextIssue = {
  field: PublicTextField;
  code: "email" | "phone" | "private-group invitation" | "exact address";
  message: string;
};

type PublicListingText = {
  title: string;
  description: string;
  approximateArea: string;
  pickupArea?: string;
};

const EMAIL = /\b[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+\b/i;
const PHONE = /(?:^|\D)\+?\d(?:[\s().-]*\d){7,}(?:\D|$)/;
const PRIVATE_LINK = /(?:https?:\/\/|www\.|chat\.whatsapp\.com|wa\.me\/|facebook\.com\/groups\/|t\.me\/)/i;
const NUMBER_THEN_STREET = /\b\d{1,5}\s+(?:[\p{L}'-]+\s*){1,6}\b(?:street|st|road|rd|avenue|ave|lane|ln|boulevard|blvd|calle|carrer|carrer de|rue|straße|strasse|via)\b/iu;
const NUMBER_THEN_PREFIXED_STREET = /\b\d{1,5}\s+(?:calle|carrer|carrer de|rue|straße|strasse|via)\s+(?:[\p{L}'-]+\s*){1,6}/iu;
const STREET_THEN_NUMBER = /\b(?:street|road|avenue|lane|boulevard|calle|carrer|carrer de|rue|straße|strasse|via)\b[^\n,;]{0,70}\b\d{1,5}\b/iu;

const messages: Record<PublicTextIssue["code"], string> = {
  email: "Remove email addresses; verified contact is handled privately.",
  phone: "Remove phone numbers; verified contact is handled privately.",
  "private-group invitation":
    "Remove links and private-group invitations from public text.",
  "exact address":
    "Use a neighborhood or broad area, never an exact street address.",
};

export function validatePublicListingText(
  input: PublicListingText,
): PublicTextIssue[] {
  const fields = Object.entries(input).filter(
    (entry): entry is [PublicTextField, string] => typeof entry[1] === "string",
  );
  const issues: PublicTextIssue[] = [];

  for (const [field, value] of fields) {
    addIssueIf(issues, field, value, EMAIL, "email");
    addIssueIf(issues, field, value, PHONE, "phone");
    addIssueIf(
      issues,
      field,
      value,
      PRIVATE_LINK,
      "private-group invitation",
    );
    if (
      NUMBER_THEN_STREET.test(value) ||
      NUMBER_THEN_PREFIXED_STREET.test(value) ||
      STREET_THEN_NUMBER.test(value)
    ) {
      issues.push({ field, code: "exact address", message: messages["exact address"] });
    }
  }

  return issues;
}

function addIssueIf(
  issues: PublicTextIssue[],
  field: PublicTextField,
  value: string,
  pattern: RegExp,
  code: PublicTextIssue["code"],
) {
  if (pattern.test(value)) issues.push({ field, code, message: messages[code] });
}
