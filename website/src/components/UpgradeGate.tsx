import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/session";
import { Lock, Crown, Check, ArrowRight } from "lucide-react";
import PlanBadge from "@/components/PlanBadge";

type Plan = "Core" | "Pro" | "Elite";

interface UpgradeGateProps {
  requiredPlan: Plan;
  overlay?: boolean;
}

const planToCopy: Record<Plan, { title: string; description: string; cta: string }> = {
  Core: {
    title: "Core plan required",
    description: "Unlock Signals, Watchlist, and core dashboard features.",
    cta: "Upgrade to Core",
  },
  Pro: {
    title: "Pro plan required",
    description: "Unlock Mentor, advanced analysis, and pro tooling.",
    cta: "Upgrade to Pro",
  },
  Elite: {
    title: "Elite plan required",
    description: "Unlock everything, including VIP features and 1:1 mentorship.",
    cta: "Upgrade to Elite",
  },
};

const UpgradeGate: React.FC<UpgradeGateProps> = ({ requiredPlan, overlay }) => {
  const session = getSession();
  const copy = planToCopy[requiredPlan];
  const currentLabel = session?.isAdmin ? "Admin" : (session?.plan || (session?.isSubscriber ? "Pro" : "Free"));

  return (
    <div className={`flex items-center justify-center ${overlay ? "min-h-[60vh]" : "h-[60vh]"}`}>
      <Card className={`w-full max-w-2xl border border-border/60 shadow-2xl ${overlay ? "bg-background/70 backdrop-blur-xl" : "bg-card/80"} rounded-2xl overflow-hidden`}>
        <div className="h-1 w-full bg-gradient-to-r from-violet-600 via-blue-500 to-cyan-400" />
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground/10">
              {requiredPlan === 'Elite' ? <Crown className="h-5 w-5 text-cyan-400" /> : <Lock className="h-5 w-5 text-blue-400" />}
            </div>
            <CardTitle className="text-2xl">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                {copy.title}
              </span>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground/90">
            {copy.description}
          </p>

          <ul className="grid sm:grid-cols-2 gap-2 text-sm">
            {requiredPlan === 'Pro' && (
              <>
                <li className="flex items-center gap-2 text-muted-foreground"><Check className="h-4 w-4 text-blue-400" /> Mentor access</li>
                <li className="flex items-center gap-2 text-muted-foreground"><Check className="h-4 w-4 text-blue-400" /> Advanced analysis</li>
                <li className="flex items-center gap-2 text-muted-foreground"><Check className="h-4 w-4 text-blue-400" /> Priority improvements</li>
                <li className="flex items-center gap-2 text-muted-foreground"><Check className="h-4 w-4 text-blue-400" /> Premium indicators</li>
              </>
            )}
            {requiredPlan === 'Core' && (
              <>
                <li className="flex items-center gap-2 text-muted-foreground"><Check className="h-4 w-4 text-violet-400" /> Signals & Watchlist</li>
                <li className="flex items-center gap-2 text-muted-foreground"><Check className="h-4 w-4 text-violet-400" /> Alerts</li>
              </>
            )}
            {requiredPlan === 'Elite' && (
              <>
                <li className="flex items-center gap-2 text-muted-foreground"><Check className="h-4 w-4 text-cyan-400" /> VIP features</li>
                <li className="flex items-center gap-2 text-muted-foreground"><Check className="h-4 w-4 text-cyan-400" /> 1:1 mentorship</li>
              </>
            )}
          </ul>

          <div className="h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              Current plan: <PlanBadge label={currentLabel} />
            </div>
            <div className="flex w-full sm:w-auto">
              <Button
                className="relative w-full sm:w-auto rounded-xl px-5 py-2.5 font-semibold text-white bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-500 hover:from-blue-500 hover:via-indigo-400 hover:to-cyan-400 shadow-lg shadow-primary/20 ring-1 ring-white/10 hover:ring-white/20 transition-all duration-300 group"
                onClick={() => { window.location.href = "/dashboard/account"; }}
              >
                <span className="mr-2">{copy.cta}</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UpgradeGate;


