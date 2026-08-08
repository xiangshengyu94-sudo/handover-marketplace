export type OtpActionState = {
  step: "email" | "code";
  message?: string;
  error?: string;
  email?: string;
  intent?: string;
  returnTo?: string;
  captchaRequired?: boolean;
};

export const initialOtpState: OtpActionState = { step: "email" };

export type AccountActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const initialAccountActionState: AccountActionState = { status: "idle" };
