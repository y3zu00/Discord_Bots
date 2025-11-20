import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import VideoSection from "@/components/VideoSection";
import AISystemsSection from "@/components/AISystemsSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import PricingSection from "@/components/PricingSection";
import FAQSection from "@/components/FAQSection";
import ConvinceSection from "@/components/ConvinceSection";
import Footer from "@/components/Footer";

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();

  React.useEffect(() => {
    const state = location.state as { reason?: string } | null;
    if (state?.reason === "subscription_required") {
      toast.error("A subscription is required to access the dashboard.");
      // clear state so it doesn't re-toast on back/refresh
      navigate("/", { replace: true, state: null });
    }
  }, [location.state, navigate]);

  return (
    <main>
      <Navbar />
      <Hero />
      <VideoSection />
      <AISystemsSection />
      <TestimonialsSection />
      <PricingSection />
      <FAQSection />
      <ConvinceSection />
      <Footer />
    </main>
  );
};

export default Index;
