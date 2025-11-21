import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getSession, createDevSession, createDevSessionForPlan } from "@/lib/session";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LifeBuoy, Link2, User, ArrowRight } from "lucide-react";

const Admin: React.FC = () => {
  const session = getSession();
  const navigate = useNavigate();
  const [ann, setAnn] = React.useState<{id:number;title:string;body:string;created_at:string;audience:string}[]>([]);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [audience, setAudience] = React.useState("all");
  const [users, setUsers] = React.useState<any[]>([]);
  const [mentorFeedback, setMentorFeedback] = React.useState<any[]>([]);
  const [mentorFeedbackDialogOpen, setMentorFeedbackDialogOpen] = React.useState(false);
  const [activeMentorFeedback, setActiveMentorFeedback] = React.useState<any | null>(null);
  const [userFeedback, setUserFeedback] = React.useState<any[]>([]);
  const [userFeedbackDialogOpen, setUserFeedbackDialogOpen] = React.useState(false);
  const [activeUserFeedback, setActiveUserFeedback] = React.useState<any | null>(null);
  const [feedbackStatusFilter, setFeedbackStatusFilter] = React.useState("all");
  const [updatingFeedbackId, setUpdatingFeedbackId] = React.useState<number | null>(null);
  const [activeTab, setActiveTab] = React.useState<"ann" | "users" | "feedback" | "mentor" | "dev">("ann");
  const [pendingFeedbackId, setPendingFeedbackId] = React.useState<number | null>(null);
  const [selectedFeedbackStatus, setSelectedFeedbackStatus] = React.useState<"new" | "in_progress" | "resolved" | "closed">("new");
  const [resolutionDraft, setResolutionDraft] = React.useState("");
  const location = useLocation();

  React.useEffect(() => {
    // Basic admin guard with redirect
    if (!session?.isAdmin) {
      toast.error("Admin only");
      navigate('/dashboard');
    }
  }, [session, navigate]);

  const loadAll = React.useCallback(async () => {
    try {
      const a = await apiFetch('/api/announcements').then(r=>r.json());
      setAnn(Array.isArray(a?.items) ? a.items : []);
    } catch {}
    try {
      const u = await apiFetch('/api/admin/users').then(r=>r.json());
      setUsers(Array.isArray(u?.items) ? u.items : []);
    } catch {}
    try {
      const [mentor, feedback] = await Promise.all([
        apiFetch('/api/admin/mentor-feedback').then(r => r.json()).catch(() => null),
        apiFetch('/api/admin/feedback').then(r => r.json()).catch(() => null),
      ]);
      setMentorFeedback(Array.isArray(mentor?.items) ? mentor.items : []);
      setUserFeedback(Array.isArray(feedback?.items) ? feedback.items : []);
    } catch {}
  }, []);

  React.useEffect(() => { loadAll(); }, [loadAll]);

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['ann', 'users', 'feedback', 'mentor', 'dev'].includes(tabParam)) {
      setActiveTab(tabParam as 'ann' | 'users' | 'feedback' | 'mentor' | 'dev');
    }
    if (tabParam === 'feedback') {
      const idParam = Number(params.get('id'));
      if (Number.isFinite(idParam) && idParam > 0) {
        setPendingFeedbackId(idParam);
      }
    }
  }, [location.search]);

  React.useEffect(() => {
    if (activeTab === 'feedback' && pendingFeedbackId && userFeedback.length) {
      const match = userFeedback.find((item) => Number(item?.id) === pendingFeedbackId);
      if (match) {
        setActiveUserFeedback(match);
        setUserFeedbackDialogOpen(true);
        setPendingFeedbackId(null);
      }
    }
  }, [activeTab, pendingFeedbackId, userFeedback]);

  React.useEffect(() => {
    if (activeUserFeedback) {
      const status = typeof activeUserFeedback.status === 'string' ? activeUserFeedback.status.toLowerCase() : 'new';
      setSelectedFeedbackStatus(['new', 'in_progress', 'resolved', 'closed'].includes(status) ? (status as 'new' | 'in_progress' | 'resolved' | 'closed') : 'new');
      setResolutionDraft(activeUserFeedback.resolution_notes || '');
    } else {
      setResolutionDraft('');
    }
  }, [activeUserFeedback]);

  const createAnnouncement = async () => {
    if (!title.trim()) return;
    try {
      const res = await apiFetch('/api/announcements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, body, audience }) });
      if (res.ok) { setTitle(""); setBody(""); toast.success('Announcement posted'); loadAll(); }
      else toast.error('Failed');
    } catch { toast.error('Failed'); }
  };

  const deleteAnnouncement = async (id: number) => {
    try {
      const res = await apiFetch(`/api/announcements/${id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Deleted'); loadAll(); }
    } catch {}
  };

  const updateUser = async (discordId: string, changes: any) => {
    try {
      const res = await apiFetch(`/api/admin/users/${discordId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes) });
      if (res.ok) { toast.success('Updated'); loadAll(); }
      else toast.error('Failed');
    } catch { toast.error('Failed'); }
  };

  const statusLabelMap: Record<string, string> = {
    new: 'New',
    in_progress: 'In progress',
    resolved: 'Resolved',
    closed: 'Closed',
  };

  const feedbackStatusOptions = ['all', 'new', 'in_progress', 'resolved', 'closed'] as const;

  const statusBadgeMap: Record<string, string> = {
    new: 'border-sky-500/40 bg-sky-500/10 text-sky-400',
    in_progress: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
    resolved: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
    closed: 'border-muted/70 bg-muted/30 text-muted-foreground',
  };

  const severityBadgeMap: Record<string, string> = {
    low: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    medium: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
    high: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
    critical: 'border-rose-500/40 bg-rose-500/10 text-rose-400',
  };

  const filteredUserFeedback = React.useMemo(() => {
    if (feedbackStatusFilter === 'all') return userFeedback;
    return userFeedback.filter((item) => {
      const status = typeof item?.status === 'string' ? item.status.toLowerCase() : 'new';
      return status === feedbackStatusFilter;
    });
  }, [userFeedback, feedbackStatusFilter]);

  const updateUserFeedbackStatus = async (id: number, status: string, notes?: string) => {
    setUpdatingFeedbackId(id);
    try {
      const res = await apiFetch(`/api/admin/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, resolutionNotes: notes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Update failed');
      }
      setActiveUserFeedback((prev) => (prev && Number(prev.id) === id ? { ...prev, status, resolution_notes: notes ?? prev.resolution_notes } : prev));
      toast.success('Feedback updated');
      await loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setUpdatingFeedbackId(null);
    }
  };

  const feedbackChanged = React.useMemo(() => {
    if (!activeUserFeedback) return false;
    const currentStatus = typeof activeUserFeedback.status === 'string' ? activeUserFeedback.status.toLowerCase() : 'new';
    const currentNotes = (activeUserFeedback.resolution_notes || '').trim();
    return selectedFeedbackStatus !== currentStatus || resolutionDraft.trim() !== currentNotes;
  }, [activeUserFeedback, selectedFeedbackStatus, resolutionDraft]);

  const openUserFeedback = (item: any) => {
    setActiveUserFeedback(item);
    setUserFeedbackDialogOpen(true);
  };

  const openMentorFeedback = (item: any) => {
    setActiveMentorFeedback(item);
    setMentorFeedbackDialogOpen(true);
  };

  const deleteUserFeedback = async (id: number) => {
    if (!window.confirm('Delete this feedback? This cannot be undone.')) return;
    try {
      const res = await apiFetch(`/api/admin/feedback/${id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Deleted'); loadAll(); setUserFeedbackDialogOpen(false); }
      else toast.error('Failed');
    } catch { toast.error('Failed'); }
  };

  const deleteMentorFeedback = async (id: number) => {
    if (!window.confirm('Delete this feedback? This cannot be undone.')) return;
    try {
      const res = await apiFetch(`/api/admin/mentor-feedback/${id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Deleted'); loadAll(); setMentorFeedbackDialogOpen(false); }
      else toast.error('Failed');
    } catch { toast.error('Failed'); }
  };

  const handleDevLogin = async () => {
    try { await apiFetch('/api/logout', { method: 'POST' }); } catch {}
    createDevSession();
    window.location.href = "/dashboard";
  };

  const handleVariant = async (plan: "Free" | "Core" | "Pro" | "Elite") => {
    try { await apiFetch('/api/logout', { method: 'POST' }); } catch {}
    createDevSessionForPlan(plan);
    window.location.href = "/dashboard";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Admin</h2>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "ann" | "users" | "feedback" | "mentor" | "dev") }>
        <TabsList>
          <TabsTrigger value="ann">Announcements</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="mentor">Mentor Feedback</TabsTrigger>
          <TabsTrigger value="dev">Dev Login</TabsTrigger>
        </TabsList>

        <TabsContent value="ann" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>New Announcement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Announcement title" />
              </div>
              <div className="space-y-2">
                <Label>Body</Label>
                <Textarea value={body} onChange={(e)=>setBody(e.target.value)} placeholder="Optional body" className="min-h-[120px]" />
              </div>
              <div className="space-y-2">
                <Label>Audience</Label>
                <Select value={audience} onValueChange={setAudience}>
                  <SelectTrigger><SelectValue placeholder="Audience" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="subscribers">Subscribers</SelectItem>
                    <SelectItem value="elite">Elite</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={createAnnouncement}>Publish</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Recent</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table className="min-w-[520px] sm:min-w-0">
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Audience</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ann.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.title}</TableCell>
                      <TableCell>{a.audience}</TableCell>
                      <TableCell>{new Date(a.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">Delete</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete announcement?</AlertDialogTitle>
                              <AlertDialogDescription>This removes it for everyone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={()=>deleteAnnouncement(a.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Users</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table className="min-w-[620px] sm:min-w-0">
                <TableHeader>
                  <TableRow>
                    <TableHead>Discord ID</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Admin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(u => (
                    <TableRow key={u.discord_id}>
                      <TableCell className="font-mono text-xs">{u.discord_id}</TableCell>
                      <TableCell>{u.username || '-'}</TableCell>
                      <TableCell>
                        {u.discord_id === session?.discordId ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="text-xs text-muted-foreground">{u.plan || 'Free'} (self)</div>
                            </TooltipTrigger>
                            <TooltipContent>Self-edit disabled; managed by WHOP</TooltipContent>
                          </Tooltip>
                        ) : (
                          <Select value={u.plan || 'Free'} onValueChange={(v)=>updateUser(u.discord_id, { plan: v })}>
                            <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Free">Free</SelectItem>
                              <SelectItem value="Core">Core</SelectItem>
                              <SelectItem value="Pro">Pro</SelectItem>
                              <SelectItem value="Elite">Elite</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.discord_id === session?.discordId ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant={u.is_admin ? 'default' : 'outline'} size="sm" disabled>
                                {u.is_admin ? 'Yes' : 'No'}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Cannot change your own admin status</TooltipContent>
                          </Tooltip>
                        ) : (
                          <Button variant={u.is_admin ? 'default' : 'outline'} size="sm" onClick={()=>updateUser(u.discord_id, { isAdmin: !u.is_admin })}>
                            {u.is_admin ? 'Yes' : 'No'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feedback" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 pb-0 md:flex-row md:items-center md:justify-between">
              <CardTitle>User Feedback Inbox</CardTitle>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>Status</span>
                  <Select value={feedbackStatusFilter} onValueChange={setFeedbackStatusFilter}>
                    <SelectTrigger className="h-9 w-[160px] border-border/60 bg-background/70">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {feedbackStatusOptions.map((option) => (
                        <SelectItem key={option} value={option} className="capitalize">
                          {option === 'all' ? 'All statuses' : statusLabelMap[option]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="h-4 w-[1px] bg-border/60" aria-hidden="true" />
                <span>{filteredUserFeedback.length} of {userFeedback.length} items</span>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {filteredUserFeedback.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
                  <LifeBuoy className="h-8 w-8 text-muted-foreground/60" />
                  <p className="font-medium">No feedback in this view</p>
                  <p className="text-xs text-muted-foreground/80">Switch filters or check back later.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-[720px] sm:min-w-0">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[110px]">Severity</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="w-[140px]">Category</TableHead>
                      <TableHead className="w-[140px]">Status</TableHead>
                      <TableHead className="w-[180px]">User</TableHead>
                      <TableHead className="w-[160px]">Created</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUserFeedback.map((item) => {
                      const severity = typeof item?.severity === 'string' ? item.severity.toLowerCase() : 'medium';
                      const status = typeof item?.status === 'string' ? item.status.toLowerCase() : 'new';
                      const severityBadge = severityBadgeMap[severity] || severityBadgeMap.medium;
                      const statusBadge = statusBadgeMap[status] || statusBadgeMap.new;
                      const category = typeof item?.category === 'string' ? item.category : 'other';
                      const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);
                      const descriptionPreview = typeof item?.description === 'string' ? item.description : '';
                      return (
                        <TableRow key={item.id} className="align-top">
                          <TableCell className="pt-4">
                            <Badge className={severityBadge} variant="outline">
                              {severity.charAt(0).toUpperCase() + severity.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell className="pt-4">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-foreground">{item.title}</p>
                              <p className="max-w-[360px] text-xs text-muted-foreground line-clamp-2">
                                {descriptionPreview || '—'}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="pt-4">
                            <Badge variant="outline" className="border-border/70 bg-background/70 capitalize">
                              {categoryLabel}
                            </Badge>
                          </TableCell>
                          <TableCell className="pt-4">
                            <Badge className={statusBadge} variant="outline">
                              {statusLabelMap[status] || 'New'}
                            </Badge>
                          </TableCell>
                          <TableCell className="pt-4">
                            <div className="space-y-1 text-xs">
                              <div className="font-medium text-foreground text-sm">{item.username || 'Unknown'}</div>
                                <div className="text-muted-foreground/80">{item.user_id}</div>
                            </div>
                          </TableCell>
                            <TableCell className="pt-4 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</TableCell>
                          <TableCell className="pt-4 text-right">
                              <Button size="sm" variant="destructive" className="mr-2 h-8" onClick={() => deleteUserFeedback(Number(item.id))}>Delete</Button>
                              <Button size="sm" variant="outline" onClick={() => openUserFeedback(item)}>Open</Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mentor" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Mentor Feedback</CardTitle></CardHeader>
            <CardContent>
              {mentorFeedback.length === 0 ? (
                <p className="text-sm text-muted-foreground">No mentor feedback recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-[720px] sm:min-w-0">
                  <TableHeader>
                    <TableRow>
                        <TableHead className="w-[110px]">Audience</TableHead>
                        <TableHead>Prompt</TableHead>
                        <TableHead className="w-[160px]">Created</TableHead>
                        <TableHead className="w-[90px]">Status</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mentorFeedback.map((item) => (
                        <TableRow key={item.id} className="align-top">
                          <TableCell className="text-xs font-medium capitalize">{item.audience || 'member'}</TableCell>
                          <TableCell className="text-xs">
                            <p className="font-semibold text-sm text-foreground">{item.title}</p>
                            <p className="max-w-[420px] text-xs text-muted-foreground line-clamp-2">{item.prompt}</p>
                        </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</TableCell>
                          <TableCell className="text-xs capitalize text-muted-foreground">
                            {item.status || 'open'}
                        </TableCell>
                        <TableCell className="text-right">
                            <Button size="sm" variant="destructive" className="mr-2 h-8" onClick={() => deleteMentorFeedback(Number(item.id))}>Delete</Button>
                            <Button size="sm" variant="outline" onClick={() => openMentorFeedback(item)}>Open</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dev" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Developer Login</CardTitle>
              <div className="text-sm text-muted-foreground">
                Create temporary test sessions to verify user experiences across different plans.
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="font-semibold">Standard Test</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Creates a standard "Pro" plan session with default settings. Good for general testing.
                  </p>
                  <Button onClick={handleDevLogin} className="w-full">
                    Login as Default (Pro)
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>

                <div className="col-span-1 md:col-span-2 lg:col-span-2 rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                  <h3 className="font-semibold">Plan-Specific Testing</h3>
                  <p className="text-sm text-muted-foreground">
                    Test the dashboard exactly as a user on a specific plan would see it.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <Button variant="outline" onClick={() => handleVariant("Free")} className="hover:border-primary/50 hover:bg-primary/5">
                      Login as Free
                    </Button>
                    <Button variant="outline" onClick={() => handleVariant("Core")} className="hover:border-primary/50 hover:bg-primary/5">
                      Login as Core
                    </Button>
                    <Button variant="outline" onClick={() => handleVariant("Pro")} className="hover:border-primary/50 hover:bg-primary/5">
                      Login as Pro
                    </Button>
                    <Button variant="outline" onClick={() => handleVariant("Elite")} className="hover:border-primary/50 hover:bg-primary/5">
                      Login as Elite
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 p-4">
                <div className="flex gap-3">
                  <LifeBuoy className="h-5 w-5 text-yellow-500 shrink-0" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-yellow-500">Development Mode Only</h4>
                    <p className="text-xs text-yellow-500/80">
                      These sessions use localStorage and bypass standard authentication. 
                      They are strictly for testing layout, permissions, and feature gating.
                      Do not use for production data entry.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={userFeedbackDialogOpen}
        onOpenChange={(open) => {
          setUserFeedbackDialogOpen(open);
          if (!open) {
            setActiveUserFeedback(null);
            setResolutionDraft('');
          }
        }}
      >
        <DialogContent className="w-full max-w-[95vw] sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Review feedback</DialogTitle>
            <DialogDescription>Coordinate fixes and keep track of follow-ups.</DialogDescription>
          </DialogHeader>
          {activeUserFeedback ? (
            <div className="space-y-5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge
                    className={
                      severityBadgeMap[(typeof activeUserFeedback.severity === 'string' ? activeUserFeedback.severity.toLowerCase() : 'medium')] ||
                      severityBadgeMap.medium
                    }
                    variant="outline"
                  >
                    {(typeof activeUserFeedback.severity === 'string' ? activeUserFeedback.severity : 'medium').toUpperCase()}
                  </Badge>
                  <Badge variant="outline" className="border-border/60 bg-background/60 capitalize">
                    {String(activeUserFeedback.category || 'other').charAt(0).toUpperCase() + String(activeUserFeedback.category || 'other').slice(1)}
                  </Badge>
                  <Badge variant="outline" className="border-border/60 bg-background/60">
                    {activeUserFeedback.plan || 'Free'}
                  </Badge>
                  <span className="text-muted-foreground/80">
                    {activeUserFeedback.include_diagnostics ? 'Diagnostics included' : 'No diagnostics'}
                  </span>
                  <span className="text-muted-foreground/80">
                    {activeUserFeedback.allow_contact ? 'Contact allowed' : 'Do not contact'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="uppercase tracking-wide text-muted-foreground">Status</span>
                  <Select value={selectedFeedbackStatus} onValueChange={(value) => setSelectedFeedbackStatus(value as 'new' | 'in_progress' | 'resolved' | 'closed')}>
                    <SelectTrigger className="h-9 w-[170px] border-border/60 bg-background/70 capitalize">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(['new', 'in_progress', 'resolved', 'closed'] as const).map((option) => (
                        <SelectItem key={option} value={option} className="capitalize">
                          {statusLabelMap[option]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-foreground">{activeUserFeedback.title}</h3>
                <p className="text-xs text-muted-foreground">
                  Submitted by {activeUserFeedback.username || 'Unknown'} ({activeUserFeedback.user_id}) •{' '}
                  {activeUserFeedback.created_at ? new Date(activeUserFeedback.created_at).toLocaleString() : 'Unknown time'}
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Details</Label>
                <div className="rounded-lg border border-border bg-muted/30 p-4 leading-relaxed whitespace-pre-wrap text-foreground">
                  {activeUserFeedback.description || '—'}
                </div>
              </div>

              {activeUserFeedback.repro_steps ? (
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Steps to reproduce</Label>
                  <div className="rounded-lg border border-border bg-muted/20 p-4 whitespace-pre-wrap">
                    {activeUserFeedback.repro_steps}
                  </div>
                </div>
              ) : null}

              {activeUserFeedback.attachment_url ? (
                <div className="space-y-1 text-sm">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Attachment</Label>
                  <a
                    href={activeUserFeedback.attachment_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-primary hover:underline"
                  >
                    <Link2 className="h-4 w-4" /> View attachment
                  </a>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Resolution notes</Label>
                <Textarea
                  value={resolutionDraft}
                  onChange={(e) => setResolutionDraft(e.target.value)}
                  placeholder="Document what changed, links to fixes, or follow-up steps."
                  className="min-h-[120px]"
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No feedback selected.</p>
          )}
          {activeUserFeedback ? (
            <DialogFooter className="pt-4 flex items-center justify-between">
              <Button
                variant="destructive"
                onClick={() => deleteUserFeedback(Number(activeUserFeedback.id))}
                disabled={updatingFeedbackId === Number(activeUserFeedback.id)}
              >
                Delete
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setUserFeedbackDialogOpen(false);
                  }}
                >
                  Close
                </Button>
                <Button
                  onClick={() => updateUserFeedbackStatus(Number(activeUserFeedback.id), selectedFeedbackStatus, resolutionDraft.trim() || undefined)}
                  disabled={updatingFeedbackId === Number(activeUserFeedback.id) || !feedbackChanged}
                >
                  {updatingFeedbackId === Number(activeUserFeedback.id) ? 'Saving…' : 'Save updates'}
                </Button>
              </div>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={mentorFeedbackDialogOpen}
        onOpenChange={(open) => {
          setMentorFeedbackDialogOpen(open);
          if (!open) setActiveMentorFeedback(null);
        }}
      >
            <DialogContent className="w-full max-w-[95vw] sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Mentor Feedback</DialogTitle>
                <DialogDescription>Captured reaction for review</DialogDescription>
              </DialogHeader>
              {activeMentorFeedback ? (
                <div className="space-y-4 text-sm">
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span><strong>User:</strong> {activeMentorFeedback.username || 'Unknown'} ({activeMentorFeedback.user_id})</span>
                    <span><strong>Plan:</strong> {activeMentorFeedback.plan || 'Free'}</span>
                    <span><strong>Reaction:</strong> {activeMentorFeedback.reaction}</span>
                    <span><strong>Mode:</strong> {activeMentorFeedback.mode || 'default'}</span>
                    <span><strong>Created:</strong> {new Date(activeMentorFeedback.created_at).toLocaleString()}</span>
                  </div>
                  {activeMentorFeedback.prompt ? (
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold">Prompt</h4>
                      <div className="rounded-md border border-border bg-muted/40 p-3 whitespace-pre-wrap">
                        {activeMentorFeedback.prompt}
                      </div>
                    </div>
                  ) : null}
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold">Response</h4>
                    <div className="rounded-md border border-border bg-muted/30 p-3 whitespace-pre-wrap text-foreground">
                      {activeMentorFeedback.response}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No feedback selected.</p>
              )}
              {activeMentorFeedback ? (
                <DialogFooter className="pt-4 flex items-center justify-between">
                  <Button
                    variant="destructive"
                    onClick={() => deleteMentorFeedback(Number(activeMentorFeedback.id))}
                  >
                    Delete
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setMentorFeedbackDialogOpen(false);
                    }}
                  >
                    Close
                  </Button>
                </DialogFooter>
              ) : null}
            </DialogContent>
          </Dialog>
    </div>
  );
};

export default Admin;


