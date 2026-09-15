import "server-only";

/**
 * Lightweight PostgREST helper for server-only use.
 * Avoids @supabase/supabase-js Realtime/WebSocket issues on Node 20.
 */

function getConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return { url: url.replace(/\/$/, ""), serviceKey };
}

type RestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: string;
  body?: unknown;
  prefer?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
};

function formatRestFailure(status: number, data: unknown, fallback: string): string {
  if (typeof data === "object" && data) {
    const row = data as { message?: unknown; details?: unknown; hint?: unknown };
    const parts = [row.message, row.details, row.hint]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0);
    if (parts.length) return parts.join(" — ");
  }
  return fallback || `Supabase request failed (${status})`;
}

export class RestError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "RestError";
    this.status = status;
    this.details = details;
  }
}

export async function adminRest<T = unknown>(
  table: string,
  options: RestOptions = {},
): Promise<T> {
  const { url, serviceKey } = getConfig();
  const method = options.method ?? "GET";
  const query = options.query ?? "";
  const headers: Record<string, string> = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };
  if (options.prefer) {
    headers.Prefer = options.prefer;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 12_000);
  const signal = options.signal ?? controller.signal;

  try {
    const res = await fetch(`${url}/rest/v1/${table}${query}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal,
      cache: "no-store",
    });

    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!res.ok) {
      throw new RestError(
        formatRestFailure(res.status, data, `Supabase request failed (${res.status})`),
        res.status,
        data,
      );
    }

    return data as T;
  } catch (err) {
    if (err instanceof RestError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new RestError("Gateway Timeout", 504);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const retryable =
        err instanceof RestError &&
        (err.status === 504 ||
          err.status === 502 ||
          err.status === 503 ||
          /timeout|fetch failed/i.test(err.message));
      if (!retryable || i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastError;
}

/** Call a PostgREST RPC (SECURITY DEFINER functions, etc.). */
export async function adminRpc<T = unknown>(
  fnName: string,
  args: Record<string, unknown> = {},
  options: { timeoutMs?: number } = {},
): Promise<T> {
  const { url, serviceKey } = getConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);

  try {
    const res = await fetch(`${url}/rest/v1/rpc/${fnName}`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!res.ok) {
      throw new RestError(
        formatRestFailure(res.status, data, `RPC ${fnName} failed (${res.status})`),
        res.status,
        data,
      );
    }

    return data as T;
  } catch (err) {
    if (err instanceof RestError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new RestError("Gateway Timeout", 504);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
