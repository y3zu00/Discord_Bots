import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getSession, isAuthenticated, syncSessionFromServer } from "@/lib/session";
import UpgradeGate from "@/components/UpgradeGate";

type Plan = "Core" | "Pro" | "Elite";

interface ProtectedRouteProps {
  children: React.ReactNode;
  minPlan?: Plan; // additional tier gate for this route (Admin always bypasses)
  fallback?: React.ReactNode; // custom fallback when blocked; defaults to UpgradeGate
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, minPlan, fallback }) => {
  const location = useLocation();
  const [checking, setChecking] = React.useState(true);
  const [authed, setAuthed] = React.useState(isAuthenticated());
  const [session, setSessionState] = React.useState(getSession());

  React.useEffect(() => {
    // If no local session, try to hydrate from server cookie
    if (!authed) {
      (async () => {
        const s = await syncSessionFromServer();
        if (s) {
          setAuthed(true);
          setSessionState(s);
        }
        setChecking(false);
      })();
    } else {
      setChecking(false);
    }
  }, [authed]);

  if (checking) {
    return null;
  }

  if (!authed) {
    // Redirect to sign-in page with a return URL
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  // Optional global subscription gate (landing redirect)
  const requireSub = (import.meta as any).env?.VITE_REQUIRE_SUB === 'true';
  if (requireSub && session && !session.isAdmin && session.isSubscriber !== true) {
    return <Navigate to="/" state={{ from: location, reason: "subscription_required" }} replace />;
  }

  // Per-route tier gating (Admin bypass)
  if (minPlan && session && !session.isAdmin) {
    const order: Record<string, number> = { Free: 0, Core: 1, Pro: 2, Elite: 3 };
    const userTier = order[session.plan || (session.isSubscriber ? 'Pro' : 'Free')] ?? 0;
    const needTier = order[minPlan];
    if (userTier < needTier) {
      return (
        <div className="relative">
          {/* Blurred preview of the gated content */}
          <div className="pointer-events-none select-none blur-[6px] md:blur-[10px] opacity-60">
            {children}
          </div>
          {/* Centered upgrade overlay */}
          <div className="absolute inset-0 flex items-center justify-center p-4">
            {fallback ?? <UpgradeGate requiredPlan={minPlan} overlay />}
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
