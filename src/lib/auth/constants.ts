// Shared by the proxy (edge-safe, no Node APIs) and the session module.
export const SESSION_COOKIE = "faisla_session";
export const SESSION_DAYS = 7;

export const DEMO_EMAIL = "demo@faisla.pk";
export const DEMO_PASSWORD = "faisla2026";

// Paths reachable without signing in.
export const PUBLIC_PATHS = ["/login", "/signup", "/api/auth", "/demo/quotation"];
