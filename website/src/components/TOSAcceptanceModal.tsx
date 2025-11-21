import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

type TOSAcceptanceModalProps = {
  open: boolean;
  onAccepted: () => Promise<void> | void;
  sessionUserId: string | null;
};

const TOS_VERSION = "2025-11-15";

const TOSAcceptanceModal: React.FC<TOSAcceptanceModalProps> = ({ open, onAccepted, sessionUserId }) => {
  const [tosAccepted, setTosAccepted] = React.useState(false);
  const [privacyAccepted, setPrivacyAccepted] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [tosContent, setTosContent] = React.useState<string>("Loading terms...");

  React.useEffect(() => {
    if (!open) {
      setTosAccepted(false);
      setPrivacyAccepted(false);
      return;
    }

    const abort = new AbortController();

    fetch("/tos.txt", { signal: abort.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load TOS (${res.status})`);
        const text = await res.text();
        setTosContent(text);
      })
      .catch((err) => {
        console.error("[TOS] Failed to fetch tos.txt:", err);
        setTosContent("Terms of Service and Privacy Policy are currently unavailable. Please contact support@jackofalltrades.vip for assistance.");
      });

    return () => abort.abort();
  }, [open]);

  const handleAccept = async () => {
    if (!tosAccepted || !privacyAccepted) {
      toast.error("Please confirm that you accept both the Terms of Service and the Privacy Policy.");
      return;
    }

    if (!sessionUserId) {
      toast.error("Session expired. Please refresh the page.");
      return;
    }

    setLoading(true);
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (sessionUserId.startsWith("dev-")) {
        headers["x-dev-user-id"] = sessionUserId;
      }

      const res = await apiFetch("/api/preferences", {
        method: "POST",
        headers,
        body: JSON.stringify({
          preferences: {
            tosAccepted: true,
            tosAcceptedAt: new Date().toISOString(),
            tosVersion: TOS_VERSION,
            privacyAccepted: true,
            privacyAcceptedAt: new Date().toISOString(),
            privacyVersion: TOS_VERSION,
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to store TOS acceptance (${res.status})`);
      }

      toast.success("Thanks for accepting the Terms of Service and Privacy Policy!");
      await onAccepted();
    } catch (err) {
      console.error("[TOS] Acceptance failed:", err);
      toast.error("We couldn't save your acceptance. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} modal>
      <DialogContent
        className="max-w-2xl w-[calc(100vw-2rem)] sm:w-full"
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Review & Accept</DialogTitle>
          <DialogDescription>
            Please review the Terms of Service and Privacy Policy. You must accept both documents to continue using Jack Of All Trades.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ScrollArea className="h-[320px] sm:h-[360px] max-h-[calc(60vh)] rounded border border-border bg-muted/30 p-4">
            <pre className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{tosContent}</pre>
          </ScrollArea>

          <div className="space-y-3">
            <label className="flex items-start gap-3 text-sm text-muted-foreground">
              <Checkbox checked={tosAccepted} onCheckedChange={(checked) => setTosAccepted(Boolean(checked))} />
              <span>I have read and accept the Terms of Service.</span>
            </label>
            <label className="flex items-start gap-3 text-sm text-muted-foreground">
              <Checkbox checked={privacyAccepted} onCheckedChange={(checked) => setPrivacyAccepted(Boolean(checked))} />
              <span>I have read and accept the Privacy Policy.</span>
            </label>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end sm:space-x-2">
          <Button onClick={handleAccept} disabled={loading} className="w-full sm:w-auto">
            {loading ? "Saving..." : "I Accept"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TOSAcceptanceModal;

