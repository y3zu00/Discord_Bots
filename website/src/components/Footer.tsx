import React from "react";
import { ArrowUpRight, Mail, MessageCircle, ExternalLink } from "lucide-react";
import ParticleBackground from "@/components/ParticleBackground";
import { Button } from "@/components/ui/button";
import MagneticButton from "@/components/MagneticButton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const [tosOpen, setTosOpen] = React.useState(false);
  const [privacyOpen, setPrivacyOpen] = React.useState(false);
  const [disclaimerOpen, setDisclaimerOpen] = React.useState(false);

  const quickLinks = [
    { name: "AI Systems", href: "#ai-systems" },
    { name: "Pricing", href: "#pricing" },
    { name: "FAQ", href: "#faq" },
    { name: "Demo Video", href: "#video-section" },
  ];

  const resources = [
    { name: "Discord Community", href: "https://discord.gg/sjsJwdZPew", external: true },
    { name: "Pro Plan (Whop)", href: "https://whop.com/jack-of-all-trades-official", external: true },
    { name: "TradingView Indicators", href: "#", external: false },
    { name: "Support", href: "https://discord.gg/sjsJwdZPew", external: true },
  ];

  const legal = [
    { name: "Docs", href: "/docs", external: true },
    { name: "Terms of Service", href: "#" },
    { name: "Privacy Policy", href: "#" },
    { name: "Disclaimer", href: "#" },
  ];

  return (
    <>
    <footer className="relative bg-background overflow-hidden">
      {/* Top glow divider */}
      <div className="pointer-events-none absolute top-0 left-0 right-0 z-10">
        <div className="h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
        <div className="mx-20 h-6 bg-gradient-to-r from-accent/20 via-foreground/10 to-accent/20 blur-xl opacity-20" />
      </div>
      
      {/* Particle background */}
      <ParticleBackground />
      
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 20% 20%, hsl(var(--accent)) 2px, transparent 2px), radial-gradient(circle at 80% 80%, hsl(var(--primary)) 2px, transparent 2px), radial-gradient(circle at 50% 50%, hsl(var(--accent)) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="py-10 lg:py-12">
          <div className="grid lg:grid-cols-4 gap-8 lg:gap-12">
            
            {/* Brand & CTA Section */}
            <div className="lg:col-span-2">
              <div className="mb-6">
                <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
                  Ready for <span className="text-accent">Profits?</span>
                </h3>
                <p className="text-muted-foreground/80 text-sm sm:text-base leading-relaxed max-w-md">
                  Join 500+ traders who are already using our AI systems to improve their trading performance. Start free with our Discord community.
                </p>
              </div>
              
              {/* Primary CTAs */}
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <MagneticButton strength={0.2}>
                  <Button 
                    size="lg" 
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base px-8 py-5 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 relative overflow-hidden group"
                    asChild
                  >
                    <a href="https://whop.com/jack-of-all-trades-official" target="_blank" rel="noopener noreferrer" className="flex items-center relative z-10">
                      <span className="relative z-10">Free Trial</span>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                      <div className="ml-3 flex items-center justify-center w-7 h-7 rounded-full bg-primary-foreground/20 group-hover:bg-primary-foreground/30 transition-colors duration-300 relative z-10">
                        <ArrowUpRight className="h-4 w-4 group-hover:rotate-45 transition-transform duration-300" />
                      </div>
                    </a>
                  </Button>
                </MagneticButton>
                
                <MagneticButton strength={0.2}>
                  <Button 
                    size="lg"
                    variant="outline"
                    className="bg-background/50 hover:bg-background/80 text-foreground hover:text-foreground border-border/50 hover:border-border font-semibold text-base px-8 py-5 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 backdrop-blur-sm relative overflow-hidden group"
                    asChild
                  >
                    <a href="https://discord.gg/sjsJwdZPew" target="_blank" rel="noopener noreferrer" className="flex items-center relative z-10">
                      Join Discord
                      <svg className="ml-3 h-5 w-5 group-hover:scale-110 transition-transform duration-300" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                      </svg>
                    </a>
                  </Button>
                </MagneticButton>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wide">Quick Links</h4>
              <ul className="space-y-3">
                {quickLinks.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground/80 hover:text-accent transition-colors duration-200"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wide">Resources</h4>
              <ul className="space-y-3">
                {resources.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      target={link.external ? "_blank" : undefined}
                      rel={link.external ? "noopener noreferrer" : undefined}
                      className="text-sm text-muted-foreground/80 hover:text-accent transition-colors duration-200 flex items-center gap-1"
                    >
                      {link.name}
                      {link.external && <ExternalLink className="w-3 h-3" />}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="py-6 border-t border-border/20">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-muted-foreground/70">
              © {currentYear} Jack Of All Trades. All rights reserved.
            </div>
            
            <div className="flex items-center gap-6">
              {/* Socials */}
              <div className="flex items-center gap-4">
                <a href="https://x.com/joatvip" target="_blank" rel="noopener noreferrer" aria-label="X" className="text-muted-foreground/60 hover:text-accent transition-colors duration-200">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </a>
                <a href="https://youtube.com/@officialjackofalltrades?si=FuogpWF7_oWLhhjH" target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="text-muted-foreground/60 hover:text-accent transition-colors duration-200">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="6" width="18" height="12" rx="3" ry="3" />
                    <polygon points="10,9 16,12 10,15" fill="currentColor" stroke="none" />
                  </svg>
                </a>
                <a href="https://www.instagram.com/jackofalltrades.vip?igsh=MWJnNW1xMGNrdHNyeQ%3D%3D&utm_source=qr" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-muted-foreground/60 hover:text-accent transition-colors duration-200">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17" cy="7" r="1.5" fill="currentColor" stroke="none" />
                  </svg>
                </a>
                <a href="https://www.tiktok.com/@jackofalltradesoffical?is_from_webapp=1&sender_device=pc" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="text-muted-foreground/60 hover:text-accent transition-colors duration-200">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M19.321 6.562a5.124 5.124 0 0 1-.443-.258 6.228 6.228 0 0 1-1.137-.966c-.849-.933-1.331-2.004-1.331-3.338H13.12v14.984c0 1.748-1.422 3.17-3.17 3.17s-3.17-1.422-3.17-3.17 1.422-3.17 3.17-3.17c.337 0 .662.052.966.15v-3.338a6.505 6.505 0 0 0-.966-.15c-3.567 0-6.458 2.891-6.458 6.458s2.891 6.458 6.458 6.458 6.458-2.891 6.458-6.458V8.729a8.635 8.635 0 0 0 4.337 1.162V6.562z"/>
                  </svg>
                </a>
                <a href="https://www.facebook.com/share/17sguxdTwG/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-muted-foreground/60 hover:text-accent transition-colors duration-200">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14 3h3V0h-3c-2.8 0-5 2.2-5 5v3H6v3h3v10h3V11h3l1-3h-4V5c0-1.1.9-2 2-2z" />
                  </svg>
                </a>
                <a href="https://discord.gg/sjsJwdZPew" target="_blank" rel="noopener noreferrer" aria-label="Discord" className="text-muted-foreground/60 hover:text-accent transition-colors duration-200">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c-.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                </a>
                <a href="https://t.me/jackofalltradesvip" target="_blank" rel="noopener noreferrer" aria-label="Telegram" className="text-muted-foreground/60 hover:text-accent transition-colors duration-200">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.5 8.5l-1.908 9.006c-.144.652-.526.81-1.065.504l-2.946-2.171-1.42 1.368c-.157.157-.288.288-.588.288l.211-2.997 5.454-4.934c.236-.21-.051-.328-.368-.118l-6.74 4.237-2.9-.906c-.63-.197-.644-.63.132-.932l11.3-4.363c.526-.192.985.129.918.998z"/>
                  </svg>
                </a>
              </div>
              {legal.map((link) => {
                if (link.name === "Terms of Service") {
                  return (
                    <button
                      key={link.name}
                      type="button"
                      onClick={() => setTosOpen(true)}
                      className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors duration-200 underline-offset-4 hover:underline"
                    >
                      {link.name}
                    </button>
                  );
                }
                if (link.name === "Privacy Policy") {
                  return (
                    <button
                      key={link.name}
                      type="button"
                      onClick={() => setPrivacyOpen(true)}
                      className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors duration-200 underline-offset-4 hover:underline"
                    >
                      {link.name}
                    </button>
                  );
                }
                if (link.name === "Disclaimer") {
                  return (
                    <button
                      key={link.name}
                      type="button"
                      onClick={() => setDisclaimerOpen(true)}
                      className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors duration-200 underline-offset-4 hover:underline"
                    >
                      {link.name}
                    </button>
                  );
                }
                return (
                  <a
                    key={link.name}
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors duration-200"
                  >
                    {link.name}
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </footer>

    <Dialog open={tosOpen} onOpenChange={setTosOpen}>
      <DialogContent className="w-full max-w-3xl max-h-[85vh] gap-0 p-0">
        <DialogHeader className="space-y-1 border-b border-border/60 px-6 py-4">
          <DialogTitle>Terms of Service</DialogTitle>
          <DialogDescription>Effective November 15, 2025</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] px-6 py-5">
          <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">1. Overview</h3>
              <p>
                This platform provides advanced AI trading software, educational tools, analytics, automation systems,
                and Discord/TradingView integrations. Using any JOAT service means you agree to these Terms and the Privacy Policy.
              </p>
            </section>
            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">2. Eligibility</h3>
              <p>Users must be 18+ (or age of majority). By accessing JOAT you represent that you meet this requirement and accept responsibility for account activity.</p>
            </section>
            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">3. Purpose & Disclaimer</h3>
              <p>
                JOAT delivers educational, research, and entertainment content only. Outputs are not financial advice.
                All trading decisions and results are your responsibility. Services are provided “as is” without warranties.
              </p>
            </section>
            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">4. Membership & Access</h3>
              <p>
                Access is licensed per tier (Core, Pro, Elite) or via one-time indicator purchases. Licenses are non-transferable.
                Subscriptions auto-renew unless cancelled before the renewal date. Refunds are generally not issued except where mandated by law (e.g., EU 14-day right of withdrawal).
              </p>
            </section>
            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">5. Data Handling</h3>
              <p>
                We collect Discord IDs, emails, usernames, and usage data for authentication, licensing, and support.
                Billing and role management may be handled by third parties such as Whop. See the Privacy Policy for details.
              </p>
            </section>
            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">6. Content & Usage</h3>
              <p>
                You may use JOAT tools for personal analysis and education. Redistributing or reselling proprietary code,
                bots, indicators, or outputs is prohibited. All intellectual property remains JOAT’s property.
              </p>
            </section>
            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">7. Conduct & Restrictions</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>No account sharing or distribution of paid materials.</li>
                <li>No reverse engineering or exploiting JOAT systems.</li>
                <li>No harassment within Discord or web services.</li>
                <li>No unlawful activity or unauthorized access attempts.</li>
              </ul>
              <p>Violations may lead to immediate termination without refund (unless required by law).</p>
            </section>
            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">8. Termination</h3>
              <p>
                JOAT may revoke access for abuse, redistribution, security breaches, term violations, or non-payment.
                You may cancel anytime through support or the payment processor. Outstanding obligations remain due upon termination.
              </p>
            </section>
            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">9. Limitation of Liability</h3>
              <p>
                JOAT is not responsible for financial losses, downtime, integration errors, or indirect damages.
                Liability does not cover gross negligence, personal injury, fraud, or non-excludable obligations.
                Total liability is limited to fees paid in the preceding 12 months.
              </p>
            </section>
            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">10. Force Majeure</h3>
              <p>JOAT is not liable for delays or failures caused by events beyond reasonable control (natural disasters, war, power/internet failures, etc.).</p>
            </section>
            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">11. Arbitration & Jurisdiction</h3>
              <p>
                Delaware law governs. Disputes go to binding AAA arbitration in Delaware, individual basis only (class-action waiver).
                You can opt out within 30 days of first acceptance. Exceptions: small claims, IP disputes, injunctive relief.
              </p>
            </section>
            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">12. Severability & Updates</h3>
              <p>
                Invalid provisions are limited or removed; the remainder stays in effect. JOAT may update these Terms with notice (email, dashboard, or Discord). Continued use means acceptance.
              </p>
            </section>
            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">13. Contact</h3>
              <p>
                support@jackofalltrades.vip · https://discord.gg/sjsJwdZPew · app.jackofalltrades.com
              </p>
            </section>
          </div>
        </ScrollArea>
        <DialogFooter className="flex justify-end border-t border-border/60 px-6 py-4">
          <Button variant="secondary" onClick={() => setTosOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
      <DialogContent className="w-full max-w-3xl max-h-[85vh] gap-0 p-0">
        <DialogHeader className="space-y-1 border-b border-border/60 px-6 py-4">
          <DialogTitle>Privacy Policy</DialogTitle>
          <DialogDescription>Effective November 15, 2025</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] px-6 py-5">
          <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">1. Information Collected</h3>
              <p>
                Identity (Discord IDs, usernames, emails), transaction metadata from payment processors, usage analytics
                (feature interactions, logs), and technical data (IP, device, browser, connection info). Payment details stay with third-party processors.
              </p>
            </section>
            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">2. Legal Basis (GDPR)</h3>
              <p>Contract performance, legitimate interest (improvements, fraud prevention), consent, and legal obligations depending on the processing activity.</p>
            </section>
            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">3. Use of Information</h3>
              <p>
                Authenticate users, manage licensing, deliver personalized tools, enforce limits, process payments, send notifications,
                improve functionality, detect abuse, and comply with law.
              </p>
            </section>
            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">4. Protection & Retention</h3>
              <p>
                Data is encrypted in transit and at rest; access is restricted. Retention: active accounts (ongoing),
                transaction records (7 years), inactive accounts deleted within 90 days unless legally required.
              </p>
            </section>
            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">5. Your Rights</h3>
              <p>
                Access, rectification, erasure, restriction, portability, objection, and consent withdrawal. CCPA users may opt-out of data sale (JOAT does not sell data). Requests answered within 30 days.
              </p>
            </section>
            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">6. Third-Party Services</h3>
              <p>Whop (billing), Discord, TradingView, analytics, hosting, and other integrations operate under their own policies. Using JOAT implies acceptance of those terms.</p>
            </section>
            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">7. International Transfers</h3>
              <p>Data may be processed outside your jurisdiction with safeguards such as Standard Contractual Clauses, adequacy decisions, and compliant vendors.</p>
            </section>
            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">8. Data Breach & Deletion</h3>
              <p>
                Users and regulators are notified of qualifying breaches. Deletion requests remove settings, history, and identifiers unless retention is legally required (e.g., tax records).
              </p>
            </section>
            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">9. Children's & California Rights</h3>
              <p>Services are for 18+. California residents receive CCPA rights (know, delete, opt-out, non-discrimination).</p>
            </section>
            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">10. Updates & Contact</h3>
              <p>
                Policies may change with notice. Contact support@jackofalltrades.vip, https://discord.gg/sjsJwdZPew,
                or the support portal for privacy requests. Response time: within 30 days.
              </p>
            </section>
          </div>
        </ScrollArea>
        <DialogFooter className="flex justify-end border-t border-border/60 px-6 py-4">
          <Button variant="secondary" onClick={() => setPrivacyOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={disclaimerOpen} onOpenChange={setDisclaimerOpen}>
      <DialogContent className="w-full max-w-3xl max-h-[85vh] gap-0 p-0">
        <DialogHeader className="space-y-1 border-b border-border/60 px-6 py-4">
          <DialogTitle>Final Disclaimer</DialogTitle>
          <DialogDescription>
            Read carefully before using any JOAT AI systems, tools, or strategies.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] px-6 py-5">
          <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">
                Disclaimers and Risk Management
              </h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <span className="font-semibold">Professional Trading Risk Warning:</span>{" "}
                  Trading with or without AI enhancement involves substantial risk and requires
                  professional risk management.
                </li>
                <li>
                  <span className="font-semibold">Substantial Risk of Loss:</span>{" "}
                  AI-enhanced trading can result in significant financial loss; past performance
                  does not guarantee future results.
                </li>
                <li>
                  <span className="font-semibold">No Guaranteed Returns:</span>{" "}
                  AI optimization, backtesting, or scoring does <span className="font-semibold">not</span> guarantee
                  profitability or any specific performance outcome.
                </li>
                <li>
                  <span className="font-semibold">Total Loss Possible:</span>{" "}
                  You can lose <span className="font-semibold">all</span> of your capital. Professional
                  position sizing, risk limits, and stop-loss discipline are mandatory.
                </li>
                <li>
                  <span className="font-semibold">Educational Framework Only:</span>{" "}
                  JOAT provides institutional-grade educational content and tools with comprehensive
                  risk awareness; outputs are for research and education, not signals to copy blindly.
                </li>
                <li>
                  <span className="font-semibold">No Financial Advice:</span>{" "}
                  Nothing in JOAT (including AI prompts, bots, charts, or text) is investment,
                  trading, tax, or financial advice.
                </li>
                <li>
                  <span className="font-semibold">Professional Responsibility:</span>{" "}
                  All trading decisions, execution, and risk management remain 100% your
                  responsibility.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">
                AI Development and Testing Framework Warning
              </h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <span className="font-semibold">Experimental AI Development:</span>{" "}
                  Advanced AI strategies, agents, and models are experimental and require
                  comprehensive validation before any live deployment.
                </li>
                <li>
                  <span className="font-semibold">Multi-Agent Coordination:</span>{" "}
                  Complex AI/multi-agent systems demand proper understanding and coordination;
                  misuse can amplify risk instead of reducing it.
                </li>
                <li>
                  <span className="font-semibold">Institutional Testing Required:</span>{" "}
                  High pass rates (90%+ across robust test suites) and scenario stress-testing are
                  mandatory before considering live capital use.
                </li>
                <li>
                  <span className="font-semibold">Professional Validation:</span>{" "}
                  Institutional-grade testing, risk modeling, and independent validation are
                  required for any AI-enhanced strategy.
                </li>
                <li>
                  <span className="font-semibold">Continuous Monitoring:</span>{" "}
                  AI-enhanced strategies require ongoing professional oversight, monitoring, and
                  version control — not “set-and-forget” usage.
                </li>
              </ul>
            </section>
          </div>
        </ScrollArea>
        <DialogFooter className="flex justify-end border-t border-border/60 px-6 py-4">
          <Button variant="secondary" onClick={() => setDisclaimerOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default Footer;
