import type { InputHTMLAttributes } from "react";

type IsoDateInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "inputMode" | "pattern" | "placeholder" | "type"
> & {
  placeholder?: string;
};

export function IsoDateInput({
  placeholder = "YYYY-MM-DD",
  ...props
}: IsoDateInputProps) {
  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"
      placeholder={placeholder}
      maxLength={10}
      autoComplete="off"
    />
  );
}
