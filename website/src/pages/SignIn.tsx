import React from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession, isAuthenticated } from "@/lib/session";
import Navbar from "@/components/Navbar";
import { toast } from "sonner";

const SignIn: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [authRedirecting, setAuthRedirecting] = React.useState(false);

  // Check for OAuth errors in URL params
  React.useEffect(() => {
    const error = searchParams.get("error");
    if (error) {
      if (error === "cancelled") {
        toast.error("Sign-in was cancelled. Please try again.");
      } else {
        toast.error("Sign-in failed. Please try again.");
      }
      // Remove error from URL
      navigate(location.pathname, { replace: true });
    }
  }, [searchParams, navigate, location.pathname]);

  // If already authenticated, redirect to dashboard
  React.useEffect(() => {
    if (isAuthenticated()) {
      const returnTo = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || "/dashboard";
      navigate(returnTo, { replace: true });
    }
  }, [navigate, location.state]);

  const handleDiscordLogin = () => {
    setAuthRedirecting(true);
    // Get the return URL from location state
    const returnTo = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || "/dashboard";
    // Pass return URL as query parameter
    const apiUrl = import.meta.env.VITE_API_URL || 'http://68.183.156.170:8787';
    setTimeout(() => {
      window.location.replace(`${apiUrl}/api/auth/discord/login?returnTo=${encodeURIComponent(returnTo)}`);
    }, 10);
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background/95 to-slate-950 px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <svg viewBox="0 0 24 24" className="w-8 h-8 text-primary" aria-hidden="true">
                <path fill="currentColor" d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
            </div>
            <CardTitle className="text-3xl font-extrabold">Welcome back</CardTitle>
            <CardDescription className="text-base">
              Sign in with your Discord account to access the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              size="lg"
              className="w-full justify-center rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold py-6 shadow-lg hover:shadow-xl transition-all duration-300"
              onClick={handleDiscordLogin}
              disabled={authRedirecting}
            >
              <span className="mr-2 inline-flex items-center justify-center w-7 h-7 rounded-md bg-white/10">
                <svg viewBox="0 0 24 24" className="w-5 h-5 block" aria-hidden="true">
                  <path fill="currentColor" d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </span>
              {authRedirecting ? "Redirecting..." : "Login with Discord"}
            </Button>
            <div className="mx-auto mt-3 w-28 h-[2px] rounded-full bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
            <p className="text-xs text-center text-muted-foreground/70">
              By continuing, you agree to our Terms and Privacy Policy.
            </p>
          </CardContent>
        </Card>
      </div>
      {authRedirecting && (
        <div className="fixed inset-0 z-[9999] bg-background" />
      )}
    </>
  );
};

export default SignIn;

