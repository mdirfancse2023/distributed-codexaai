import { useState, useEffect, useRef } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Plus, LogOut, Search, Folder, Loader2, MoreVertical, Trash, Download, Edit, ArrowUpRight, Check, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api, AUTH_EXPIRED_MESSAGE, clearAuthState, getUserInfo } from "@/lib/api";
import { useProtectedSession } from "@/hooks/use-protected-session";
import { PlanResponse, ProjectSummaryResponse, SubscriptionResponse } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { fetchProjectThumbnail, generateGradient, cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThemeToggle } from "@/components/theme-toggle";

export function ProjectsDashboard() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [projects, setProjects] = useState<ProjectSummaryResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [newProjectName, setNewProjectName] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);


    // Rename state
    const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
    const [projectToRename, setProjectToRename] = useState<ProjectSummaryResponse | null>(null);
    const [renameName, setRenameName] = useState("");
    const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);
    const [isOpeningPortal, setIsOpeningPortal] = useState(false);
    const [checkoutPlanId, setCheckoutPlanId] = useState<number | null>(null);
    const [isPlanPopoverOpen, setIsPlanPopoverOpen] = useState(false);
    const authenticated = useProtectedSession();
    const thumbnailRequestsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!authenticated) return;
        document.title = "Codexa AI by Md Irfan";
        fetchProjects();
        fetchSubscription();
    }, [authenticated]);

    useEffect(() => {
        if (!authenticated || projects.length === 0) return;

        projects.forEach((project) => {
            if (project.thumbnailUrl) return;

            const requestKey = `${project.id}:${project.name.toLowerCase().trim()}`;
            if (thumbnailRequestsRef.current.has(requestKey)) return;

            thumbnailRequestsRef.current.add(requestKey);

            void fetchProjectThumbnail(project.name)
                .then((thumbnailUrl) => {
                    if (!thumbnailUrl) return;

                    setProjects((currentProjects) =>
                        currentProjects.map((currentProject) =>
                            currentProject.id === project.id &&
                            currentProject.name === project.name &&
                            !currentProject.thumbnailUrl
                                ? { ...currentProject, thumbnailUrl }
                                : currentProject
                        )
                    );
                })
                .finally(() => {
                    thumbnailRequestsRef.current.delete(requestKey);
                });
        });
    }, [authenticated, projects]);

    const upgradePlans: PlanResponse[] = [
        { id: 1, name: "Codexa Pro", maxProjects: 100, maxTokensPerDay: 1000000, unlimitedAi: true },
        { id: 2, name: "Codexa Plus", maxProjects: 25, maxTokensPerDay: 200000, unlimitedAi: false },
    ];

    const fetchProjects = async () => {
        try {
            const data = await api.getProjects();
            setProjects(data);
        } catch (error) {
            if (error instanceof Error && error.message === AUTH_EXPIRED_MESSAGE) {
                return;
            }

            console.error("Failed to fetch projects:", error);
            toast({
                title: "Error",
                description: "Failed to load projects. Please try again.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const fetchSubscription = async () => {
        try {
            const subscriptionData = await api.getCurrentSubscription();
            setSubscription(subscriptionData);
        } catch (error) {
            if (error instanceof Error && error.message === AUTH_EXPIRED_MESSAGE) {
                return;
            }

            console.error("Failed to load subscription:", error);
        }
    };

    const handleCreateProject = async () => {
        if (!newProjectName.trim()) return;

        setIsCreating(true);
        try {
            const newProject = await api.createProject(newProjectName);
            const updatedProject = {
                ...newProject,
                role: "OWNER",
            };

            setProjects((currentProjects) => [updatedProject, ...currentProjects]);
            setNewProjectName("");
            setIsDialogOpen(false);
            toast({
                title: "Success",
                description: "Project created successfully",
            });
        } catch (error) {
            console.error("Failed to create project:", error);
            toast({
                title: "Error",
                description: "Failed to create project",
                variant: "destructive",
            });
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteProject = async (e: React.MouseEvent, projectId: number) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this project? This action cannot be undone.")) return;

        try {
            await api.deleteProject(projectId.toString());
            setProjects(projects.filter(p => p.id !== projectId));
            toast({ title: "Success", description: "Project deleted successfully" });
        } catch (error) {
            console.error("Failed to delete:", error);
            toast({ title: "Error", description: "Failed to delete project", variant: "destructive" });
        }
    };

    const handleDownloadProject = async (e: React.MouseEvent, projectId: number) => {
        e.stopPropagation();
        try {
            const blob = await api.downloadProjectZip(projectId.toString());
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `project-${projectId}.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast({ title: "Success", description: "Download started" });
        } catch (error) {
            console.error("Failed to download:", error);
            toast({ title: "Error", description: "Failed to download project", variant: "destructive" });
        }
    };

    const handleRenameClick = (e: React.MouseEvent, project: ProjectSummaryResponse) => {
        e.stopPropagation();
        setProjectToRename(project);
        setRenameName(project.name);
        setIsRenameDialogOpen(true);
    };

    const handleRenameSubmit = async () => {
        if (!projectToRename || !renameName.trim()) return;

        try {
            await api.updateProject(projectToRename.id.toString(), renameName);
            setProjects((currentProjects) =>
                currentProjects.map((project) =>
                    project.id === projectToRename.id
                        ? { ...project, name: renameName, thumbnailUrl: undefined }
                        : project
                )
            );
            setIsRenameDialogOpen(false);
            setProjectToRename(null);
            toast({ title: "Success", description: "Project renamed successfully" });
        } catch (error) {
            console.error("Failed to rename:", error);
            toast({ title: "Error", description: "Failed to rename project", variant: "destructive" });
        }
    };

    const handleLogout = () => {
        clearAuthState();
        navigate("/login", { replace: true });
    };

    const currentPlan = subscription?.plan;
    const currentPlanName = (currentPlan?.name || "FREE").toUpperCase();
    const currentPlanBadgeLabel = currentPlan?.name
        ? currentPlan.name.replace(/^codexa\s+/i, "").toUpperCase()
        : "FREE";
    const hasUnlimitedAi = (plan: PlanResponse) => Boolean(plan.unlimitedAi ?? plan.unlimtedAi);

    const getPlanPriceLabel = (plan: PlanResponse) => {
        if (plan.price) return plan.price;

        const normalized = plan.name.toLowerCase();
        if (normalized.includes("plus")) return "Upgrade plan";
        if (normalized.includes("pro")) return "Premium plan";
        return "Custom";
    };

    const handleOpenPortal = async () => {
        setIsOpeningPortal(true);
        try {
            const response = await api.openBillingPortal();
            window.open(response.portalUrl, "_blank", "noopener,noreferrer");
        } catch (error) {
            console.error("Failed to open billing portal:", error);
            toast({
                title: "Billing portal unavailable",
                description: error instanceof Error ? error.message : "Could not open billing portal.",
                variant: "destructive",
            });
        } finally {
            setIsOpeningPortal(false);
        }
    };

    const handleCheckout = async (plan: PlanResponse) => {
        setCheckoutPlanId(plan.id);
        try {
            const response = await api.createCheckoutSession(plan.id);
            window.location.href = response.checkoutUrl;
        } catch (error) {
            console.error("Failed to create checkout session:", error);
            toast({
                title: "Checkout failed",
                description: error instanceof Error ? error.message : "Could not start checkout.",
                variant: "destructive",
            });
        } finally {
            setCheckoutPlanId(null);
        }
    };

    const filteredProjects = projects.filter((project) =>
        project.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!authenticated) {
        return <Navigate to="/login" replace />;
    }

    return (
        <>
            <div className="min-h-screen bg-background">
                {/* Header */}
                <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <div className="container grid min-h-14 w-full max-w-screen-2xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-3 sm:gap-3 sm:px-8 sm:py-0">
                        <div className="flex min-w-0 items-center gap-2 text-sm font-bold sm:gap-2 sm:text-lg">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/20 sm:h-8 sm:w-8">
                                <Folder className="h-[18px] w-[18px] text-primary sm:h-5 sm:w-5" />
                            </div>
                            <span className="truncate whitespace-nowrap leading-none">Codexa AI by Md Irfan</span>
                        </div>
                        <div className="flex min-w-0 flex-nowrap items-center justify-end gap-1 sm:gap-2">
                            <ThemeToggle />
                            <Popover open={isPlanPopoverOpen} onOpenChange={setIsPlanPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <button
                                        type="button"
                                        disabled={isOpeningPortal}
                                        className="inline-flex h-8 min-w-[58px] max-w-[78px] items-center justify-center overflow-hidden rounded-md border border-primary bg-primary px-2 text-[10px] font-bold uppercase tracking-normal text-primary-foreground shadow-sm disabled:opacity-70 sm:h-8 sm:min-w-0 sm:max-w-none sm:px-2.5 sm:text-[11px] sm:tracking-[0.12em]"
                                    >
                                        {isOpeningPortal ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <span className="max-w-full truncate">{currentPlanBadgeLabel}</span>
                                        )}
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent
                                    align="end"
                                    side="bottom"
                                    className="w-[min(360px,calc(100vw-1.5rem))] p-3"
                                >
                                    <div className="mb-3">
                                        <div className="text-sm font-semibold">{currentPlanName}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {currentPlanName === "FREE"
                                                ? "Choose a paid plan to continue with more limits and features."
                                                : "Your current subscription details and billing actions."}
                                        </div>
                                    </div>
                                    {currentPlanName !== "FREE" && (
                                        <div className="mb-3 rounded-xl border p-3">
                                            <div className="mb-2 flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-sm font-semibold">{currentPlanName}</h3>
                                                        <Badge variant="secondary">Current</Badge>
                                                    </div>
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        {subscription?.currentPeriodEnd
                                                            ? `Renews through ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                                                            : "Active subscription"}
                                                    </p>
                                                </div>
                                                <Crown className="h-4 w-4 text-primary" />
                                            </div>
                                            <div className="mb-3 space-y-1.5 text-xs text-muted-foreground">
                                                <div className="flex items-center gap-2">
                                                    <Check className="h-3.5 w-3.5 text-primary" />
                                                    <span>{subscription?.plan?.maxProjects ?? "-"} projects</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Check className="h-3.5 w-3.5 text-primary" />
                                                    <span>{subscription?.plan?.maxTokensPerDay?.toLocaleString() ?? "-"} tokens per day</span>
                                                </div>
                                            </div>
                                            <Button className="w-full gap-2" variant="outline" onClick={handleOpenPortal} disabled={isOpeningPortal}>
                                                {isOpeningPortal ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
                                                Manage Billing
                                            </Button>
                                        </div>
                                    )}
                                    {currentPlanName === "FREE" && (
                                        <div className="space-y-3">
                                        {upgradePlans.length > 0 ? (
                                            upgradePlans.map((plan) => {
                                                const isPro = plan.name.toLowerCase().includes("pro");

                                                return (
                                                    <div key={plan.id} className={cn("rounded-xl border p-3", isPro && "border-primary/50 bg-primary/5")}>
                                                        <div className="mb-2 flex items-start justify-between gap-3">
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <h3 className="text-sm font-semibold">{plan.name.toUpperCase()}</h3>
                                                                    {isPro && <Badge variant="secondary">Popular</Badge>}
                                                                </div>
                                                                <p className="mt-1 text-xs text-muted-foreground">{getPlanPriceLabel(plan)}</p>
                                                            </div>
                                                            <Crown className={cn("h-4 w-4", isPro ? "text-primary" : "text-muted-foreground")} />
                                                        </div>
                                                        <div className="mb-3 space-y-1.5 text-xs text-muted-foreground">
                                                            <div className="flex items-center gap-2">
                                                                <Check className="h-3.5 w-3.5 text-primary" />
                                                                <span>{plan.maxProjects} projects</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Check className="h-3.5 w-3.5 text-primary" />
                                                                <span>{plan.maxTokensPerDay.toLocaleString()} tokens per day</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Check className="h-3.5 w-3.5 text-primary" />
                                                                <span>{hasUnlimitedAi(plan) ? "Unlimited AI access" : "Expanded AI access"}</span>
                                                            </div>
                                                        </div>
                                                        <Button className="w-full gap-2" onClick={() => handleCheckout(plan)} disabled={checkoutPlanId === plan.id}>
                                                            {checkoutPlanId === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
                                                            Choose {plan.name}
                                                        </Button>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                                                No upgrade plans are available from the current backend configuration.
                                            </div>
                                        )}
                                        </div>
                                    )}
                                </PopoverContent>
                            </Popover>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full p-0 sm:h-9 sm:w-9">
                                        <Avatar className="h-8 w-8 sm:h-9 sm:w-9">
                                            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                                {(() => {
                                                    const userInfo = getUserInfo();
                                                    if (userInfo?.name) {
                                                        return userInfo.name.charAt(0).toUpperCase();
                                                    }
                                                    return "U";
                                                })()}
                                            </AvatarFallback>
                                        </Avatar>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                    <div className="flex flex-col space-y-1 p-2">
                                        <p className="text-sm font-medium leading-none">
                                            {getUserInfo()?.name || "User"}
                                        </p>
                                        <p className="text-xs leading-none text-muted-foreground">
                                            {getUserInfo()?.username || ""}
                                        </p>
                                    </div>
                                    <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600 cursor-pointer">
                                        <LogOut className="w-4 h-4 mr-2" />
                                        Sign Out
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </header>

                <main className="container max-w-screen-2xl px-3 py-5 sm:px-8 sm:py-8">
                    <div className="mb-6 flex flex-col items-stretch justify-between gap-4 sm:mb-8 sm:flex-row sm:items-center">
                        <div className="space-y-1">
                            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Projects</h1>
                            <p className="text-muted-foreground mt-1">
                                Manage and create your AI-powered projects
                            </p>
                        </div>

                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="w-full gap-2 sm:w-auto">
                                <Plus className="w-4 h-4" />
                                New Project
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg">
                            <DialogHeader>
                                <DialogTitle>Create New Project</DialogTitle>
                                <DialogDescription>
                                    Give your project a name to get started. You can change this later.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                                <Input
                                    placeholder="My Awesome Project"
                                    value={newProjectName}
                                    onChange={(e) => setNewProjectName(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                                />
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleCreateProject} disabled={isCreating || !newProjectName.trim()}>
                                    {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Create Project
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Rename Dialog */}
                    <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
                        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg">
                            <DialogHeader>
                                <DialogTitle>Rename Project</DialogTitle>
                            </DialogHeader>
                            <div className="py-4">
                                <Input
                                    value={renameName}
                                    onChange={(e) => setRenameName(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleRenameSubmit()}
                                />
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>Cancel</Button>
                                <Button onClick={handleRenameSubmit} disabled={!renameName.trim() || renameName === projectToRename?.name}>
                                    Save
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Search */}
                <div className="relative mb-6 w-full max-w-md sm:mb-8">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search projects..."
                        className="h-11 pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : filteredProjects.length === 0 ? (
                    <div className="rounded-lg border border-dashed py-16 text-center sm:py-20">
                        <h3 className="text-lg font-semibold mb-2">No projects found</h3>
                        <p className="text-muted-foreground mb-6">
                            {searchQuery ? "Try a different search query" : "Create your first project to get started"}
                        </p>
                        {!searchQuery && (
                            <Button onClick={() => setIsDialogOpen(true)}>Create Project</Button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
                        {filteredProjects.map((project) => (
                            <Card
                                key={project.id}
                                className="group cursor-pointer overflow-hidden rounded-2xl border-border/60 transition-all hover:border-primary/50 hover:shadow-lg"
                                onClick={() => navigate(`/projects/${project.id}`)}
                            >
                                <CardHeader className="p-0">
                                    <div className="aspect-video bg-muted/50 w-full relative overflow-hidden rounded-t-lg">
                                        {project.thumbnailUrl ? (
                                            <img
                                                src={project.thumbnailUrl}
                                                alt={project.name}
                                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                            />
                                        ) : (
                                            <div className="w-full h-full" style={generateGradient(project.name)} />
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-2 p-4 sm:p-5">
                                    <div className="flex justify-between items-start gap-2">
                                        <CardTitle className="text-lg group-hover:text-primary transition-colors line-clamp-1">
                                            {project.name}
                                        </CardTitle>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-2 text-muted-foreground hover:text-foreground">
                                                    <MoreVertical className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={(e) => handleRenameClick(e, project)}>
                                                    <Edit className="w-4 h-4 mr-2" />
                                                    Rename
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={(e) => handleDownloadProject(e, project.id)}>
                                                    <Download className="w-4 h-4 mr-2" />
                                                    Download
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-red-500 focus:text-red-500" onClick={(e) => handleDeleteProject(e, project.id)}>
                                                    <Trash className="w-4 h-4 mr-2" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    {project.role && (
                                        <div className="flex">
                                            <span className={cn(
                                                "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border",
                                                project.role === 'OWNER' ? "bg-primary/10 text-primary border-primary/20" :
                                                    project.role === 'EDITOR' ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                                                        "bg-muted text-muted-foreground border-border"
                                            )}>
                                                {project.role}
                                            </span>
                                        </div>
                                    )}
                                </CardContent>
                                <CardFooter className="p-4 pt-0 text-xs text-muted-foreground">
                                    Updated {new Date(project.createdAt).toLocaleDateString()}
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                    )}
                </main>
            </div>
        </>
    );
}
