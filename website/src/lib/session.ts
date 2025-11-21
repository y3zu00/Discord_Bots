import { apiFetch } from "./api";

export type Session = {
  userId: string;
  username: string;
  avatarUrl?: string;
  token?: string; // placeholder for future real auth
  // Discord-specific fields (optional until real OAuth wired)
  discordId?: string;
  discordUsername?: string;
  discordAvatarUrl?: string;
  // Subscription access
  isSubscriber: boolean;
  plan?: "Free" | "Core" | "Pro" | "Elite";
  // Admin access
  isAdmin?: boolean;
};

const STORAGE_KEY = "joat:session";

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function setSession(session: Session | null): void {
  if (!session) {
    localStorage.removeItem(STORAGE_KEY);
    try {
      window.dispatchEvent(new CustomEvent('joat:session:update', { detail: null }));
    } catch {}
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  try {
    window.dispatchEvent(new CustomEvent('joat:session:update', { detail: session }));
  } catch {}
}

export function isAuthenticated(): boolean {
  return !!getSession();
}

// Dev utility: create a fake session (used by /dev-login)
export function createDevSession(): Session {
  const session: Session = {
    userId: "dev-user",
    username: "Developer",
    avatarUrl: "https://cdn.discordapp.com/embed/avatars/0.png",
    discordId: "000000000000000000",
    discordUsername: "Developer#0001",
    discordAvatarUrl: "https://cdn.discordapp.com/embed/avatars/0.png",
    isSubscriber: true,
    plan: "Pro",
    token: "dev-token",
  };
  setSession(session);
  return session;
}

export function createDevSessionForPlan(plan: "Free" | "Core" | "Pro" | "Elite"): Session {
  const isSubscriber = plan !== "Free";
  const session: Session = {
    userId: `dev-${plan.toLowerCase()}`,
    username: `Dev ${plan}`,
    avatarUrl: "https://cdn.discordapp.com/embed/avatars/1.png",
    discordId: "000000000000000000",
    discordUsername: `dev_${plan.toLowerCase()}`,
    discordAvatarUrl: "https://cdn.discordapp.com/embed/avatars/1.png",
    isSubscriber,
    plan,
    token: `dev-token-${plan.toLowerCase()}`,
  };
  setSession(session);
  return session;
}

// Fetch session from backend if cookie is present
export async function syncSessionFromServer(): Promise<Session | null> {
  try {
    const res = await apiFetch("/api/session");
    if (!res.ok) return null;
    const data = await res.json();
    if (data && (data as any).session) {
      const sess = (data as any).session as Session;
      setSession(sess);
      return sess;
    }
    return null;
  } catch {
    return null;
  }
}


