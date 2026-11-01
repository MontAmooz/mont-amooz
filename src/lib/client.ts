// مُنت‌آموز — client-side API helper (Task 2-b, frontend)
// All requests go to the same-origin /api/v1 base; the ma_session cookie rides along.

const BASE = "/api/v1";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Human-readable Persian fallback per HTTP status. */
function fallbackMessage(status: number): string {
  switch (status) {
    case 400:
      return "درخواست نامعتبر است.";
    case 401:
      return "برای این کار باید وارد حساب کاربری شوید.";
    case 403:
      return "اجازهٔ انجام این کار را ندارید.";
    case 404:
      return "موردی که دنبالش بودید پیدا نشد.";
    case 409:
      return "این مورد از قبل وجود دارد.";
    case 500:
      return "خطای سرور؛ لطفاً کمی بعد دوباره تلاش کنید.";
    default:
      return "خطای نامشخص در ارتباط با سرور.";
  }
}

export interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** JSON body — automatically serialized with the right Content-Type. */
  json?: unknown;
  signal?: AbortSignal;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = "GET", json, signal } = options;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: "same-origin",
      headers: json !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: json !== undefined ? JSON.stringify(json) : undefined,
      signal,
    });
  } catch {
    throw new ApiError("ارتباط با سرور برقرار نشد؛ لطفاً اتصال خود را بررسی کنید.", 0);
  }

  let data: unknown = null;
  const text = await res.text().catch(() => "");
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // non-JSON body — treat as null
    }
  }

  if (!res.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : fallbackMessage(res.status);
    throw new ApiError(message, res.status);
  }

  return (data ?? {}) as T;
}
