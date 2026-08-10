// src/api/client/client.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { QueryClient } from "@tanstack/react-query";
import Cookies from "js-cookie";
import { isAuthRoute, isPublicRoute } from "@/lib/middleware-session";

const API_TIMEOUT = 30000;
// Track if we're already redirecting to prevent loops
let isRedirecting = false;

// Helper function to handle redirects to login page
const redirectToLogin = () => {
  if (typeof window !== "undefined" && !isRedirecting) {
    isRedirecting = true;

    // Clear any auth tokens
    Cookies.remove("sessionToken");

    // Only redirect if we're not already on the login page
    if (!window.location.pathname.includes("/login")) {
      window.location.href = `/login?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    } else {
      // Reset the redirect flag if we're already on login
      isRedirecting = false;
    }
  }
};

export class ApiError extends Error {
  constructor(
    public code: number,
    public message: string,
    public data?: unknown
  ) {
    super(message);
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL + "/api",
  timeout: API_TIMEOUT,
  withCredentials: true,
  headers: { "Cache-Control": "no-cache" }
});

// Request interceptor — deliberately a pass-through.
//
// There is no client-side auth decision to make here: better-auth's session
// cookie is httpOnly, so this code cannot read it, and `withCredentials` sends
// it automatically. Whether a request is allowed is the backend's call, and we
// act on its 401 in the response interceptor below.
//
// This previously classified the outgoing URL against a local PUBLIC_ROUTES
// array and threw the result away. Beyond being dead, it was a SECOND source of
// truth for "public" that could drift from lib/middleware-session.ts, and it
// shadowed the isPublicRoute imported above. If you ever need a route check
// here, import it from lib/middleware-session.ts — never re-declare the list.
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => config,
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle auth errors here
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const hasNoResponse = !error.response || error.code === "ERR_EMPTY_RESPONSE" || error.message === "Network Error";
    const body = error.response?.data;
    const message = hasNoResponse
      ? "Server closed the connection. Ensure the backend is running and run: npx prisma migrate deploy"
      : (body?.details ?? body?.error ?? body?.message ?? "Unknown error");
    const normalizedError: ApiError = {
      code: error.response?.status || 500,
      message,
      data: error.response?.data,
      name: error.response?.data?.name || "ApiError",
    };
    console.log("error", normalizedError);
    // Handle 401 (Unauthorized) responses - this is the only place we redirect.
    // Never redirect off a public page (e.g. "/", "/pay/*") — an anonymous
    // visitor getting a 401 from a background query (any component can fire
    // one, e.g. Sidebar's groups query) there is expected, not an auth
    // failure. See lib/middleware-session.ts for the canonical route list.
    if (normalizedError.code === 401 && typeof window !== "undefined") {
      const currentPath = window.location.pathname;
      const isPublicPage = isAuthRoute(currentPath) || isPublicRoute(currentPath);
      if (!isPublicPage) {
        redirectToLogin();
      }
    }

    return Promise.reject(normalizedError);
  }
);

// Query client configuration
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      // The response interceptor above rejects with `normalizedError`, a plain
      // {code, message, data, name} object — NOT an AxiosError. Reading
      // `.response?.status` here therefore always yielded undefined, the 401
      // short-circuit never fired, and every 401 was retried twice: one
      // signed-out page load sent GET /api/users/me three times. Branch on the
      // normalized `code`, and keep the AxiosError read as a fallback for any
      // caller that rejects before the interceptor normalizes.
      retry: (failureCount, error) => {
        const status =
          (error as ApiError)?.code ?? (error as AxiosError)?.response?.status;
        if (status === 401) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});
