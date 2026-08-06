// src/api/client/client.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { QueryClient } from "@tanstack/react-query";
import Cookies from "js-cookie";
import { isAuthRoute, isPublicRoute } from "@/lib/middleware-session";

const API_TIMEOUT = 30000;
// Track if we're already redirecting to prevent loops
let isRedirecting = false;

// Routes that don't require auth checking
const PUBLIC_ROUTES = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/verify",
  "/api/auth/reset-password",
  "/api/auth/forgot-password",
  // Public payer flow — no account, ever. See .specs/2026-08-06-request-money-api-contract.md
  "/api/public/requests",
];

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

// Request interceptor - only check if the route requires auth
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== "undefined") {
      const sessionToken = Cookies.get("sessionToken");
      const url = config.url || "";

      // Only redirect for authenticated routes
      const isPublicRoute = PUBLIC_ROUTES.some((route) => url.includes(route));

      // For non-public routes we rely on backend 401 if session is missing.
      // Note: better-auth uses httpOnly cookies, so sessionToken may be empty here.
    }

    return config;
  },
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
      retry: (failureCount, error) => {
        console.log("retry", failureCount, error);
        const axiosError = error as AxiosError;
        if (axiosError.response?.status === 401) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});
