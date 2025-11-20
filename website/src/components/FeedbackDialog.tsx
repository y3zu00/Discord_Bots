import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type FeedbackDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const categories = [
  { value: "bug", label: "Bug / Issue" },
  { value: "feature", label: "Feature request" },
  { value: "mentor", label: "AI Mentor" },
  { value: "billing", label: "Billing / subscription" },
  { value: "performance", label: "Performance" },
  { value: "other", label: "Other" },
];

const severities = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const severityAccent: Record<string, { badge: string; ring: string; text: string }> = {
  low: {
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    ring: "ring-emerald-500/30",
    text: "text-emerald-400",
  },
  medium: {
    badge: "border-sky-500/30 bg-sky-500/10 text-sky-400",
    ring: "ring-sky-500/30",
    text: "text-sky-400",
  },
  high: {
    badge: "border-amber-500/40 bg-amber-500/10 text-amber-400",
    ring: "ring-amber-500/30",
    text: "text-amber-400",
  },
  critical: {
    badge: "border-rose-500/40 bg-rose-500/10 text-rose-400",
    ring: "ring-rose-500/40",
    text: "text-rose-400",
  },
};

const FeedbackDialog: React.FC<FeedbackDialogProps> = ({ open, onOpenChange }) => {
  const [category, setCategory] = React.useState("bug");
  const [severity, setSeverity] = React.useState("high");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [attachmentUrl, setAttachmentUrl] = React.useState("");
  const [allowContact, setAllowContact] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  const reset = React.useCallback(() => {
    setCategory("bug");
    setSeverity("high");
    setTitle("");
    setDescription("");
    setAttachmentUrl("");
    setAllowContact(true);
    setSubmitting(false);
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  const descriptionRemaining = Math.max(0, 2000 - description.length);

  const handleSubmit = async () => {
    if (submitting) return;
    if (title.trim().length < 4) {
      toast.error("Title is too short");
      return;
    }
    if (description.trim().length < 10) {
      toast.error("Add more detail so we can help");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          severity,
          title,
          description,
          attachmentUrl,
          allowContact,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Unable to submit feedback');
      }

      toast.success('Thank you for the feedback!');
      handleOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const severityStyles = severityAccent[severity] || severityAccent.medium;

  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const original = document.body.style.overflow;
    if (open) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="scrollbar max-w-2xl w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto border border-border/60 bg-background/95 backdrop-blur shadow-2xl">
        <DialogHeader className="space-y-2 pb-2">
          <DialogTitle className="text-2xl font-semibold tracking-tight">Share feedback</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Tell us what's working, what's not, or what you'd love to see next. Critical issues notify the team instantly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground" htmlFor="feedback-category">Category</Label>
              <select
                id="feedback-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-11 w-full rounded-md border border-border/70 bg-background/80 px-3 text-sm text-foreground shadow-sm transition focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {categories.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground" htmlFor="feedback-severity">Urgency</Label>
              <select
                id="feedback-severity"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className={cn(
                  "h-11 w-full rounded-md border border-border/70 bg-background/80 px-3 text-sm text-foreground shadow-sm transition focus:border-primary/60 focus:outline-none focus:ring-2",
                  severityStyles.ring
                )}
              >
                {severities.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Badge className={cn("mt-2 inline-flex w-max text-xs", severityStyles.badge)}>
                {severity === 'critical'
                  ? 'Critical · Requires immediate attention'
                  : severity === 'high'
                  ? 'High · Blocks trading or major features'
                  : severity === 'medium'
                  ? 'Medium · Impacts workflow'
                  : 'Low · Nice to have'}
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short summary (e.g., Alerts paused but still firing)"
              maxLength={160}
              className="h-11 w-full border border-border/70 bg-background/80 text-foreground"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <Label className="text-sm font-medium text-foreground">What happened?</Label>
                <span className="text-[11px] text-muted-foreground">Please include at least 10 characters so we can help.</span>
              </div>
              <span className="text-xs text-muted-foreground">{descriptionRemaining} chars left</span>
            </div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Give us the details so we can reproduce it or understand what you need."
              maxLength={2000}
              className="min-h-[140px] w-full border border-border/70 bg-background/80 text-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Screenshot / Loom link (optional)</Label>
            <Input
              value={attachmentUrl}
              onChange={(e) => setAttachmentUrl(e.target.value)}
              placeholder="https://"
              className="h-11 w-full border border-border/70 bg-background/80 text-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Paste a link to a screenshot, screen recording, or any supporting file.
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/80 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Let us follow up if needed</p>
              <p className="text-xs text-muted-foreground">We'll send a Discord DM only when we need more context.</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="allow-contact" checked={allowContact} onCheckedChange={setAllowContact} />
              <Label htmlFor="allow-contact" className="text-sm text-foreground">Okay to contact me</Label>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-4">
          <div className="flex flex-1 flex-col-reverse items-stretch gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span className="text-center sm:text-left">
              🚀 Feedback goes straight to the founders & posted in the admin dashboard instantly.
            </span>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button variant="outline" onClick={() => handleOpenChange(false)} className="w-full border-border/70 sm:w-auto">
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full bg-gradient-to-r from-primary via-primary/90 to-primary/70 text-primary-foreground shadow-[0_12px_30px_-18px_rgba(59,130,246,0.65)] sm:w-auto"
              >
                {submitting ? 'Sending…' : 'Submit feedback'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FeedbackDialog;




