import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import React from "react";
import { syncSessionFromServer } from "@/lib/session";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Docs from "./pages/Docs";
import SignIn from "./pages/SignIn";
import DashboardLayout from "./components/DashboardLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import Overview from "./pages/dashboard/Overview";
import Signals from "./pages/dashboard/Signals";
import Mentor from "./pages/dashboard/Mentor";
import Account from "./pages/dashboard/Account";
import Watchlist from "./pages/dashboard/Watchlist";
import Alerts from "./pages/dashboard/Alerts";
import Notifications from "./pages/dashboard/Notifications";
import News from "./pages/dashboard/News";
import Prices from "./pages/dashboard/Prices";
import SettingsPage from "./pages/dashboard/Settings";
import Admin from "./pages/dashboard/Admin";
import Indicators from "./pages/dashboard/Indicators";
import ErrorBoundary from "./components/ErrorBoundary";

const queryClient = new QueryClient();

const isBrowser = typeof window !== "undefined";
const hostname = isBrowser ? window.location.hostname : "";
const isDocsSubdomain = hostname === "docs.jackofalltrades.vip";
const isAppSubdomain = hostname === "app.jackofalltrades.vip";

const App = () => {
  React.useEffect(() => {
    // Try to hydrate session from server cookie on first load
    syncSessionFromServer();
  }, []);

  React.useEffect(() => {
    if (!isBrowser) return;

    // Force docs subdomain to the docs route
    if (isDocsSubdomain && window.location.pathname !== "/docs") {
      window.location.replace("/docs");
      return;
    }

    // Force app subdomain root to dashboard (auth gate handled by ProtectedRoute)
    if (isAppSubdomain && window.location.pathname === "/") {
      window.location.replace("/dashboard");
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/docs" element={<Docs />} />
          
          {/* Protected Dashboard Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <ErrorBoundary>
                <DashboardLayout />
              </ErrorBoundary>
            </ProtectedRoute>
          }>
            <Route index element={<Overview />} />
            <Route path="signals" element={
              <ProtectedRoute minPlan="Core">
                <Signals />
              </ProtectedRoute>
            } />
            <Route path="watchlist" element={<Watchlist />} />
            <Route path="news" element={<News />} />
            <Route path="prices" element={<Prices />} />
            <Route path="indicators" element={<Indicators />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="mentor" element={
              <ProtectedRoute minPlan="Pro">
                <Mentor />
              </ProtectedRoute>
            } />
            <Route path="notifications" element={<Notifications />} />
            <Route path="account" element={<Account />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="admin" element={<Admin />} />
          </Route>
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
