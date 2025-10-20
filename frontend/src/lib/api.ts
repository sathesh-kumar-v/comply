// // src/lib/api.ts

// const RAW_BASE =
//   process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api";

// export const API_BASE = RAW_BASE.replace(/\/+$/, "");

// function joinUrl(base: string, tail: string): string {
//   const sep = base.endsWith("/") ? "" : "/";
//   const t = tail.replace(/^\/+/, "");
//   return `${base}${sep}${t}`;
// }

// function getAuthToken(): string | null {
//   if (typeof window === "undefined") return null;
//   try {
//     return (
//       localStorage.getItem("auth_token") ??
//       localStorage.getItem("access_token")
//     );
//   } catch {
//     return null;
//   }
// }

// function buildUrl(path: string): string {
//   try {
//     const maybe = new URL(path);
//     return maybe.toString();
//   } catch {
//     /* not absolute */
//   }
//   const p = path.startsWith("/") ? path : `/${path}`;
//   const baseEndsWithApi = /\/api$/i.test(API_BASE);

//   if (baseEndsWithApi) {
//     if (p.toLowerCase() === "/api") return API_BASE;
//     if (p.toLowerCase().startsWith("/api/")) {
//       const remainder = p.slice(5); // drop "/api/"
//       return joinUrl(API_BASE, remainder);
//     }
//     return joinUrl(API_BASE, p);
//   }
//   return new URL(p, API_BASE).toString();
// }

// // export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
// //   const headers = new Headers(init.headers ?? undefined);

// //   const hasBody = init.body != null && !(init.body instanceof FormData);
// //   if (hasBody && !headers.has("Content-Type")) {
// //     headers.set("Content-Type", "application/json");
// //   }
// //   if (!headers.has("Accept")) headers.set("Accept", "application/json");

// //   const token = getAuthToken();
// //   if (token && !headers.has("Authorization")) {
// //     headers.set("Authorization", `Bearer ${token}`);
// //   }

// //   const url = buildUrl(path);

// //   let res: Response;
// //   try {
// //     res = await fetch(url, {
// //       ...init,
// //       headers,
// //       cache: "no-store",
// //       // rely on browser defaults for mode/credentials
// //     });
// //   } catch (e) {
// //     // Only hit when the browser blocks (CORS/mixed content) or the server is unreachable
// //     throw new Error(`Network error fetching ${url}. ${String(e)}`);
// //   }

// //   if (!res.ok) {
// //     const text = await res.text().catch(() => "");
// //     throw new Error(text || `${res.status} ${res.statusText} (${url})`);
// //   }

// //   const text = await res.text();
// //   return (text ? JSON.parse(text) : (null as unknown)) as T;
// // }

// async function parseJsonSafely<T>(res: Response): Promise<T> {
//   const text = await res.text();
//   if (!text) return null as unknown as T;
//   try {
//     return JSON.parse(text) as T;
//   } catch {
//     // If server sent plain text or HTML by mistake, surface a clear error
//     throw new Error(
//       `Expected JSON but got:\n${text.slice(0, 500)}${
//         text.length > 500 ? "..." : ""
//       }`
//     );
//   }
// }

// type FetchOptions = RequestInit & { timeoutMs?: number; retries?: number };

// /**
//  * Main API helper
//  * - Adds auth header if present
//  * - Times out (AbortController) and retries once by default
//  * - Clear errors that differentiate HTTP error vs. network/CORS error
//  */
// export async function api<T>(
//   path: string,
//   init: FetchOptions = {}
// ): Promise<T> {
//   const headers = new Headers(init.headers ?? undefined);

//   const hasBody = init.body != null && !(init.body instanceof FormData);
//   if (hasBody && !headers.has("Content-Type")) {
//     headers.set("Content-Type", "application/json");
//   }
//   if (!headers.has("Accept")) headers.set("Accept", "application/json");

//   const token = getAuthToken();
//   if (token && !headers.has("Authorization")) {
//     headers.set("Authorization", `Bearer ${token}`);
//   }

//   const url = buildUrl(path);

//   const timeoutMs = init.timeoutMs ?? 15000; // 15s default
//   const retries = init.retries ?? 1; // retry once on network error

//   const attempt = async (): Promise<Response> => {
//     const controller = new AbortController();
//     const timer = setTimeout(() => controller.abort(), timeoutMs);

//     try {
//       // NOTE: we don’t force mode/credentials here; defaults are usually correct.
//       // If you need cookies, uncomment credentials:"include" on purpose.
//       const res = await fetch(url, {
//         ...init,
//         headers,
//         cache: init.cache ?? "no-store",
//         signal: controller.signal,
//       });
//       clearTimeout(timer);
//       return res;
//     } catch (e) {
//       clearTimeout(timer);
//       // Network/CORS/mixed-content/aborted
//       // Keep the original TypeError but add helpful context
//       const hint =
//         "This is a network-level failure (server down, CORS blocked, or mixed content). " +
//         "Confirm your backend is running at the URL above and that CORS is configured to allow the frontend origin.";
//       const msg = e instanceof Error ? e.message : String(e);
//       const err = new Error(`Network error fetching ${url}. ${msg}\n${hint}`);
//       (err as any).cause = e;
//       throw err;
//     }
//   };

//   let res: Response;
//   try {
//     res = await attempt();
//   } catch (e) {
//     if (retries > 0) {
//       // brief backoff then retry once
//       await new Promise((r) => setTimeout(r, 200));
//       res = await attempt();
//     } else {
//       throw e;
//     }
//   }

//   if (!res.ok) {
//     // HTTP error with a response (NOT a CORS/network failure)
//     const body = await res.text().catch(() => "");
//     const contentType = res.headers.get("content-type") || "";
//     const detail =
//       body && contentType.includes("application/json")
//         ? (() => {
//             try {
//               const j = JSON.parse(body);
//               return JSON.stringify(j);
//             } catch {
//               return body;
//             }
//           })()
//         : body;

//     throw new Error(
//       `HTTP ${res.status} ${res.statusText} for ${url}${
//         detail ? `\n${detail}` : ""
//       }`
//     );
//   }

//   return parseJsonSafely<T>(res);
// }

// src/lib/api.ts

function resolveApiBase(): string {
  const envBase = process.env.NEXT_PUBLIC_API_BASE?.trim();
  if (envBase) return envBase;

  if (typeof window !== "undefined") {
    // When running in the browser default to hitting the Next.js rewrite at /api/*.
    return "/api";
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.SITE_URL?.trim();
  if (siteUrl) {
    const normalized = siteUrl.startsWith("http")
      ? siteUrl
      : `https://${siteUrl}`;
    return `${normalized.replace(/\/+$/, "")}/api`;
  }

  return "http://localhost:8000/api";
}

const RAW_BASE = resolveApiBase();
export const API_BASE = RAW_BASE.replace(/\/+$/, "");

/** Join base + tail without losing '/api' */
function joinUrl(base: string, tail: string): string {
  const sep = base.endsWith("/") ? "" : "/";
  const t = tail.replace(/^\/+/, "");
  return `${base}${sep}${t}`;
}

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return (
      localStorage.getItem("auth_token") ??
      localStorage.getItem("access_token")
    );
  } catch {
    return null;
  }
}

/** Build absolute URL from API_BASE + path. Accepts absolute URLs too. */
function buildUrl(path: string): string {
  try {
    const maybe = new URL(path);
    return maybe.toString(); // already absolute
  } catch {
    /* relative */
  }

  const p = path.startsWith("/") ? path : `/${path}`;
  const baseEndsWithApi = /\/api$/i.test(API_BASE);

  if (baseEndsWithApi) {
    if (p.toLowerCase() === "/api") return API_BASE;
    if (p.toLowerCase().startsWith("/api/")) {
      // avoid /api/api/*
      const remainder = p.slice(5);
      return joinUrl(API_BASE, remainder);
    }
    return joinUrl(API_BASE, p);
  }
  return new URL(p, API_BASE).toString();
}

async function parseJsonSafely<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return null as unknown as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Expected JSON but got:\n${text.slice(0, 500)}${text.length > 500 ? "..." : ""}`
    );
  }
}

type FetchOptions = RequestInit & { timeoutMs?: number; retries?: number };

/**
 * Main API helper:
 * - Adds auth header if present
 * - Times out via AbortController
 * - Retries once on network failure
 * - Distinguishes HTTP error vs network/CORS error
 */
export async function api<T>(path: string, init: FetchOptions = {}): Promise<T> {
  const headers = new Headers(init.headers ?? undefined);

  const hasBody = init.body != null && !(init.body instanceof FormData);
  if (hasBody && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  const token = getAuthToken();
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);

  const url = buildUrl(path);
  const timeoutMs = init.timeoutMs ?? 15000;
  const retries = init.retries ?? 1;

  const attempt = async (): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...init,
        headers,
        cache: init.cache ?? "no-store",
        // Do NOT force mode/credentials; keep browser defaults to avoid unnecessary preflights.
        signal: controller.signal,
      });
      clearTimeout(timer);
      return res;
    } catch (e) {
      clearTimeout(timer);
      // This is only reached on CORS blocks, timeouts (AbortError), DNS/server down, etc.
      const hint =
        "This is a network-level failure (server down, CORS blocked, or mixed content). " +
        "Verify the backend is running at the URL above and CORS allows your frontend origin.";
      const msg = e instanceof Error ? e.message : String(e);
      const err = new Error(`Network error fetching ${url}. ${msg}\n${hint}`);
      (err as any).cause = e;
      throw err;
    }
  };

  let res: Response;
  try {
    res = await attempt();
  } catch (e) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 200));
      res = await attempt();
    } else {
      throw e;
    }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const contentType = res.headers.get("content-type") || "";
    const detail =
      body && contentType.includes("application/json")
        ? (() => {
            try {
              const j = JSON.parse(body);
              return JSON.stringify(j);
            } catch {
              return body;
            }
          })()
        : body;

    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}${detail ? `\n${detail}` : ""}`);
  }

  return parseJsonSafely<T>(res);
}
