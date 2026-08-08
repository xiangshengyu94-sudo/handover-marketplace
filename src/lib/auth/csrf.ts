export type OriginHeaders = {
  origin?: string;
  host?: string;
  forwardedHost?: string;
};

export class CsrfError extends Error {
  constructor() {
    super("Request not accepted.");
    this.name = "CsrfError";
  }
}

export function assertSameOrigin({
  origin,
  host,
  forwardedHost,
}: OriginHeaders) {
  const effectiveHost = forwardedHost ?? host;
  if (!origin || !effectiveHost || !isSingleHost(effectiveHost)) {
    throw new CsrfError();
  }

  try {
    const parsedOrigin = new URL(origin);
    if (
      !["http:", "https:"].includes(parsedOrigin.protocol) ||
      parsedOrigin.username ||
      parsedOrigin.password ||
      parsedOrigin.host !== effectiveHost
    ) {
      throw new CsrfError();
    }
  } catch (error) {
    if (error instanceof CsrfError) throw error;
    throw new CsrfError();
  }
}

function isSingleHost(value: string) {
  return (
    value === value.trim() &&
    !value.includes(",") &&
    !/[\r\n\u0000]/.test(value)
  );
}
