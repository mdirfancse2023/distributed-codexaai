import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import {
  Code,
  Sparkles,
  LogOut,
  Loader2,
  MoreVertical,
  Trash,
  Download,
  Edit,
  Folder,
  Calculator,
  ListTodo,
  FileText,
  MessageSquare,
  ShoppingCart,
  Wallet,
  CreditCard,
  Receipt,
  Utensils,
  Truck,
  Music,
  Video,
  Gamepad2,
  Image as ImageIcon,
  GraduationCap,
  HelpCircle,
  HeartPulse,
  Dumbbell,
  CloudSun,
  MapPin,
  Plane,
  LayoutDashboard,
  BarChart3,
  Briefcase,
  Code2,
  Plug,
  Database,
  Settings,
  Book,
  Timer,
  Clock,
  Newspaper,
  Home,
  Car,
  Bike,
  Crown,
} from "lucide-react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ChatPanel, ChatMessage } from "@/components/ChatPanel";
import { CodePanel } from "@/components/CodePanel";
import { PreviewPanel } from "@/components/PreviewPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api, AUTH_EXPIRED_MESSAGE, clearAuthState, getPreviewUrlStorageKey, getUserInfo } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import { RuntimeErrorAlert, RuntimeError } from "@/components/RuntimeErrorAlert";
import { generateGradient, getProjectIcon, cn } from "@/lib/utils";
import { PlanResponse, ProjectResponse, SubscriptionResponse } from "@/lib/types";
import { ShareDialog } from "@/components/ShareDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useProtectedSession } from "@/hooks/use-protected-session";
import { ThemeToggle } from "@/components/theme-toggle";

type ViewMode = "code" | "preview";
type MobilePanelMode = "split" | "workspace" | "chat";

export function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const authenticated = useProtectedSession();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [mobilePanelMode, setMobilePanelMode] = useState<MobilePanelMode>("split");
  const [updatedFiles, setUpdatedFiles] = useState<Map<string, string>>(new Map());
  const [filesRefreshToken, setFilesRefreshToken] = useState(0);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [runtimeError, setRuntimeError] = useState<RuntimeError | null>(null);
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);
  const [isUpgradePopoverOpen, setIsUpgradePopoverOpen] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [checkoutPlanId, setCheckoutPlanId] = useState<number | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const iconComponents: Record<string, React.ElementType> = {
    "calculator": Calculator,
    "list-todo": ListTodo,
    "file-text": FileText,
    "message-square": MessageSquare,
    "shopping-cart": ShoppingCart,
    "wallet": Wallet,
    "credit-card": CreditCard,
    "receipt": Receipt,
    "utensils": Utensils,
    "truck": Truck,
    "music": Music,
    "video": Video,
    "gamepad-2": Gamepad2,
    "image": ImageIcon,
    "graduation-cap": GraduationCap,
    "help-circle": HelpCircle,
    "heart-pulse": HeartPulse,
    "dumbbell": Dumbbell,
    "cloud-sun": CloudSun,
    "map-pin": MapPin,
    "plane": Plane,
    "layout-dashboard": LayoutDashboard,
    "bar-chart-3": BarChart3,
    "briefcase": Briefcase,
    "code-2": Code2,
    "plug": Plug,
    "database": Database,
    "settings": Settings,
    "book": Book,
    "timer": Timer,
    "clock": Clock,
    "newspaper": Newspaper,
    "home": Home,
    "car": Car,
    "bike": Bike,
    "crown": Crown,
    "sparkles": Sparkles,
    "folder": Folder,
  };

  // Rename state
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameName, setRenameName] = useState("");
  const userInfo = getUserInfo();

  // Track edited files for current streaming response
  const currentEditedFilesRef = useRef<string[]>([]);

  const collapseConsecutiveUserDuplicates = (messages: ChatMessage[]) => {
    return messages.filter((msg, idx, arr) => {
      if (idx === 0) return true;
      const prev = arr[idx - 1];
      if (msg.role !== "user" || prev.role !== "user") return true;
      return (prev.content ?? "").trim() !== (msg.content ?? "").trim();
    });
  };

  // Load chat history on mount
  useEffect(() => {
    if (!authenticated || !projectId) return;

    const loadData = async () => {
      setIsLoadingHistory(true);
      try {
        console.log("Loading data for project:", projectId);
        
        const [history, projectData] = await Promise.all([
          api.getChatHistory(projectId).catch(err => {
            console.error("Chat history error:", err);
            return [];
          }),
          api.getProject(projectId).catch(err => {
            console.error("Project data error:", err);
            throw err;
          })
        ]);

        console.log("Chat history loaded:", history);
        console.log("Project data loaded:", projectData);

        const formattedMessages: ChatMessage[] = history.map((msg) => ({
          id: msg.id.toString(),
          role: msg.role === "USER" ? "user" : "assistant",
          content: msg.content,
          createdAt: msg.createdAt,
          events: msg.events,
        }));
        setMessages(formattedMessages);
        setProject(projectData);
      } catch (error) {
        if (error instanceof Error && error.message === AUTH_EXPIRED_MESSAGE) {
          return;
        }

        console.error("Failed to load project data:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        toast({
          title: "Error",
          description: `Failed to load project data: ${errorMessage}`,
          variant: "destructive"
        });
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadData();
  }, [authenticated, projectId, toast]);

  useEffect(() => {
    if (!authenticated) return;

    const loadSubscription = async () => {
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

    loadSubscription();
  }, [authenticated]);

  const handleLogout = () => {
    clearAuthState();
    navigate("/login", { replace: true });
  };

  const handleGoToProjects = () => {
    navigate("/projects", { replace: true });
  };

  const upgradePlans: PlanResponse[] = [
    { id: 1, name: "Codexa Pro", maxProjects: 100, maxTokensPerDay: 1000000, unlimitedAi: true },
    { id: 2, name: "Codexa Plus", maxProjects: 25, maxTokensPerDay: 200000, unlimitedAi: false },
  ];

  const currentPlan = subscription?.plan;
  const currentPlanName = (currentPlan?.name || "FREE").toUpperCase();
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
      setIsUpgradePopoverOpen(false);
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

  const handlePublish = async () => {
    if (!projectId) return;

    setIsPublishing(true);
    try {
      const response = await api.deploy(projectId);
      localStorage.setItem(getPreviewUrlStorageKey(projectId), response.previewUrl);
      window.open(response.previewUrl, "_blank", "noopener,noreferrer");
      toast({
        title: "Published successfully",
        description: "Your project was published and opened in a new tab.",
      });
    } catch (error) {
      console.error("Failed to publish project:", error);
      toast({
        title: "Publish failed",
        description: error instanceof Error ? error.message : "Could not publish project.",
        variant: "destructive",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSendMessage = useCallback((content: string) => {
    if (!projectId) return;

    // Reset edited files tracker
    currentEditedFilesRef.current = [];

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);

    // Create placeholder for AI response
    const aiMessageId = (Date.now() + 1).toString();
    const aiMessage: ChatMessage = {
      id: aiMessageId,
      role: "assistant",
      content: "",
      isStreaming: true,
      editedFiles: [],
    };

    setMessages((prev) => [...prev, aiMessage]);

    const cleanup = api.streamChat(
      projectId,
      content,
      (chunk) => {
        // Append chunk to streaming message (character by character)
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId
              ? { ...msg, content: msg.content + chunk, isStreaming: true }
              : msg
          )
        );
      },
      (path, fileContent) => {
        // Update file content
        setUpdatedFiles((prev) => new Map(prev).set(path, fileContent));

        // Track edited file
        if (!currentEditedFilesRef.current.includes(path)) {
          currentEditedFilesRef.current.push(path);
        }

        // Update the message with edited files
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId
              ? { ...msg, editedFiles: [...currentEditedFilesRef.current] }
              : msg
          )
        );
      },
      async () => {
        // Stream complete
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId
              ? { ...msg, isStreaming: false, editedFiles: [...currentEditedFilesRef.current] }
              : msg
          )
        );
        setIsStreaming(false);
        setTimeout(() => {
          setFilesRefreshToken((prev) => prev + 1);
        }, 500);

        // Refresh chat history to show persisted events after completion
        try {
          const history = await api.getChatHistory(projectId);
          const formattedMessages: ChatMessage[] = history.map((msg) => ({
            id: msg.id.toString(),
            role: msg.role === "USER" ? "user" : "assistant",
            content: msg.content,
            createdAt: msg.createdAt,
            events: msg.events,
          }));
          setMessages(collapseConsecutiveUserDuplicates(formattedMessages));
        } catch (error) {
          console.error("Failed to refresh chat history:", error);
        }
      },
      (error) => {
        // Handle error - preserve any content that was received
        console.error("Stream error:", error);
        
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === aiMessageId) {
              // If we received some content, keep it
              if (msg.content && msg.content.trim()) {
                return { 
                  ...msg, 
                  isStreaming: false,
                  editedFiles: [...currentEditedFilesRef.current]
                };
              } else {
                // Only show error if no content was received
                return { 
                  ...msg, 
                  content: "Sorry, the stream was interrupted. Please try again.", 
                  isStreaming: false 
                };
              }
            }
            return msg;
          })
        );
        
        setIsStreaming(false);
        
        toast({
          title: "Stream interrupted",
          description: "The response may be incomplete. Any changes have been preserved.",
          variant: "destructive",
        });
      }
    );

    return cleanup;
  }, [projectId, toast]);

  // Listen for runtime errors from the preview iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security check: ensure message is from our expected source if possible
      // In local dev, origins might be localhost:5173 or localhost:8080

      const data = event.data;
      if (data?.type === 'PreviewError') {
        const error = data.payload;
        console.log("Caught runtime error:", error);
        setRuntimeError({
          message: error.message,
          source: data.subType,
          stack: error.stack,
          filename: error.source, // Map filename from payload source
          lineno: error.lineno,
          colno: error.colno,
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleFixError = useCallback((error: RuntimeError) => {
    const isDefaultExportMismatch = error.message.includes("does not provide an export named 'default'");
    const prompt = isDefaultExportMismatch
      ? `I encountered an import/export mismatch in my application.

Error Message: ${error.message}
${error.filename ? `File: ${error.filename}` : ""}
${error.lineno ? `Line: ${error.lineno}` : ""}

Stack Trace:
${error.stack || "No stack trace available"}

Please inspect the file that imports the module and the referenced module itself. Fix the mismatch by doing exactly one of these:
1. change the import to a named import if the module only exports named symbols, or
2. add a default export if that is the intended API.

Do not change unrelated code. Ensure the preview builds without this module export error.`
      : `I encountered a ${error.source || "runtime error"} in my application:
    
Error Message: ${error.message}
${error.filename ? `File: ${error.filename}` : ''}
${error.lineno ? `Line: ${error.lineno}` : ''}

Stack Trace:
${error.stack || "No stack trace available"}

Please analyze this error and fix the code to resolve it.`;

    handleSendMessage(prompt);
    setRuntimeError(null);
  }, [handleSendMessage]);

  const handleDeleteProject = async () => {
    if (!projectId) return;
    if (!confirm("Are you sure you want to delete this project? This action cannot be undone.")) return;

    try {
      await api.deleteProject(projectId);
      navigate("/projects");
      toast({ title: "Success", description: "Project deleted successfully" });
    } catch (error) {
      console.error("Failed to delete:", error);
      toast({ title: "Error", description: "Failed to delete project", variant: "destructive" });
    }
  };

  const handleDownloadProject = async () => {
    if (!projectId) return;
    try {
      const blob = await api.downloadProjectZip(projectId);
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

  const openRenameDialog = () => {
    if (project) {
      setRenameName(project.name);
      setIsRenameDialogOpen(true);
    }
  };

  const handleRenameSubmit = async () => {
    if (!projectId || !renameName.trim()) return;

    try {
      const updated = await api.updateProject(projectId, renameName);
      setProject(prev => prev ? { ...prev, name: updated.name } : null);
      setIsRenameDialogOpen(false);
      toast({ title: "Success", description: "Project renamed successfully" });
    } catch (error) {
      console.error("Failed to rename:", error);
      toast({ title: "Error", description: "Failed to rename project", variant: "destructive" });
    }
  };

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!projectId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Invalid project ID</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="shrink-0 overflow-x-hidden border-b border-border/50 bg-panel px-3 py-2">
        <div className={cn(
          "flex min-w-0 gap-3 overflow-x-hidden",
          isMobile ? "flex-col" : "items-center overflow-x-auto whitespace-nowrap"
        )}>
          <div className="flex min-w-0 items-center gap-2 overflow-hidden">
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
              {project ? (
                <>
                  {(() => {
                    const iconKey = getProjectIcon(project.name);
                    const Icon = iconComponents[iconKey] || Folder;
                    return (
                      <div className="w-7 h-7 rounded-sm shadow-sm bg-background/80 border border-border/60 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-foreground" />
                      </div>
                    );
                  })()}
                  <span className={cn("truncate font-semibold text-sm", isMobile && "max-w-[88px]")}>{project.name}</span>
                </>
              ) : (
                <>
                  <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="truncate font-semibold text-sm">Loading...</span>
                </>
              )}
            </div>
            {project?.role !== 'VIEWER' && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={openRenameDialog}>
                    <Edit className="w-4 h-4 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDownloadProject}>
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-red-500 focus:text-red-500" onClick={handleDeleteProject}>
                    <Trash className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {isMobile && (
              <div className="ml-1 flex shrink-0 items-center rounded-lg bg-muted/30 p-0.5">
                <button
                  onClick={() => setMobilePanelMode("workspace")}
                  className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium transition-all rounded-md ${mobilePanelMode === "workspace"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  |
                </button>
                <button
                  onClick={() => setMobilePanelMode("split")}
                  className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium transition-all rounded-md ${mobilePanelMode === "split"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  []
                </button>
                <button
                  onClick={() => setMobilePanelMode("chat")}
                  className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium transition-all rounded-md ${mobilePanelMode === "chat"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  |
                </button>
              </div>
            )}
            <div className={cn(
              "flex shrink-0 items-center rounded-lg bg-muted/30 p-0.5",
              isMobile ? "ml-0" : "ml-[22rem]"
            )}>
              <button
                onClick={() => setViewMode("preview")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all rounded-md ${isMobile ? "gap-1 px-1 py-0.5 text-[8px]" : ""} ${viewMode === "preview"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                <Sparkles className={cn(isMobile ? "h-1.5 w-1.5" : "h-3 w-3")} />
                Preview
              </button>
              <button
                onClick={() => setViewMode("code")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all rounded-md ${isMobile ? "gap-1 px-1 py-0.5 text-[8px]" : ""} ${viewMode === "code"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                <Code className={cn(isMobile ? "h-1.5 w-1.5" : "h-3 w-3")} />
                Code
              </button>
            </div>
          </div>

          <div className={cn(
            "flex-1",
            isMobile
              ? "grid grid-cols-1 gap-3"
              : "ml-3 grid min-w-[560px] grid-cols-[1fr_auto] items-center gap-4"
          )}>
            <div className={cn(
              "flex items-center gap-2",
              isMobile ? "flex-nowrap justify-start whitespace-nowrap gap-1.5" : "justify-center"
            )}>
              <ShareDialog
                projectId={projectId}
                trigger={
                  <Button variant="outline" size="sm" className={cn("text-xs font-medium", isMobile ? "h-7 px-2 text-[11px]" : "h-8")} disabled={project?.role === 'VIEWER'}>
                    Share
                  </Button>
                }
              />
              {project?.role !== 'VIEWER' && (
                <>
                  <Popover open={isUpgradePopoverOpen} onOpenChange={setIsUpgradePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn(isMobile ? "h-7 px-2 text-[11px]" : "h-8 text-xs")}>
                        Upgrade
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="center" side="bottom" className="w-[360px] p-3">
                      <div className="mb-3">
                        <div className="text-sm font-semibold">{currentPlanName}</div>
                        <div className="text-xs text-muted-foreground">
                          {currentPlanName === "FREE"
                            ? "Choose a paid plan to continue with more limits and features."
                            : "Your current subscription details and billing actions."}
                        </div>
                      </div>
                      {currentPlanName !== "FREE" && (
                        <div className="rounded-xl border p-3">
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
                            <div>{subscription?.plan?.maxProjects ?? "-"} projects</div>
                            <div>{subscription?.plan?.maxTokensPerDay?.toLocaleString() ?? "-"} tokens per day</div>
                          </div>
                          <Button className="w-full gap-2" variant="outline" onClick={handleOpenPortal} disabled={isOpeningPortal}>
                            {isOpeningPortal ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Manage Billing
                          </Button>
                        </div>
                      )}
                      {currentPlanName === "FREE" && (
                        <div className="space-y-3">
                          {upgradePlans.map((plan) => {
                            const isPro = plan.name.toLowerCase().includes("pro");

                            return (
                              <div key={plan.id} className={cn("rounded-xl border p-3", isPro && "border-primary/50 bg-primary/5")}>
                                <div className="mb-2 flex items-start justify-between gap-3">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h3 className="text-sm font-semibold">{plan.name.toUpperCase()}</h3>
                                      {isPro ? <Badge variant="secondary">Popular</Badge> : null}
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">{getPlanPriceLabel(plan)}</p>
                                  </div>
                                  <Crown className={cn("h-4 w-4", isPro ? "text-primary" : "text-muted-foreground")} />
                                </div>
                                <div className="mb-3 space-y-1.5 text-xs text-muted-foreground">
                                  <div>{plan.maxProjects} projects</div>
                                  <div>{plan.maxTokensPerDay.toLocaleString()} tokens per day</div>
                                  <div>{hasUnlimitedAi(plan) ? "Unlimited AI access" : "Expanded AI access"}</div>
                                </div>
                                <Button className="w-full gap-2" onClick={() => handleCheckout(plan)} disabled={checkoutPlanId === plan.id}>
                                  {checkoutPlanId === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                  Choose {plan.name}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                  <Button
                    size="sm"
                    className={cn("bg-primary hover:bg-primary/90", isMobile ? "h-7 px-2 text-[11px]" : "h-8 text-xs")}
                    onClick={handlePublish}
                    disabled={isPublishing}
                  >
                    {isPublishing ? <Loader2 className={cn("animate-spin", isMobile ? "h-3 w-3" : "h-3.5 w-3.5")} /> : null}
                    Publish
                  </Button>
                </>
              )}
              {isMobile && (
                <>
                  <ThemeToggle />
                  <div className="flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/30 px-1.5 py-1">
                    <Avatar className="h-5 w-5 border border-primary/20">
                      <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-semibold">
                        {userInfo?.name ? userInfo.name.charAt(0).toUpperCase() : "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span className={cn(
                      "min-w-[50px] text-center text-[9px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded",
                      !project
                        ? "bg-muted text-muted-foreground"
                        : project.role === 'OWNER'
                          ? "bg-primary/10 text-primary"
                          : project.role === 'EDITOR'
                            ? "bg-amber-500/10 text-amber-600"
                            : "bg-muted text-muted-foreground"
                    )}>
                      {project?.role ?? "Loading"}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleGoToProjects}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    aria-label="Go to all projects"
                  >
                    <Home className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLogout}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}
            </div>

            <div className={cn(
              "flex items-center gap-2",
              isMobile ? "hidden" : "justify-end"
            )}>
              <ThemeToggle />
              <div className="flex items-center gap-2 rounded-full border border-border/50 bg-muted/30 px-2 py-1">
                <Avatar className="h-6 w-6 border border-primary/20">
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                    {userInfo?.name ? userInfo.name.charAt(0).toUpperCase() : "U"}
                  </AvatarFallback>
                </Avatar>
                <span className={cn(
                  "min-w-[58px] text-center text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded",
                  !project
                    ? "bg-muted text-muted-foreground"
                    : project.role === 'OWNER'
                      ? "bg-primary/10 text-primary"
                      : project.role === 'EDITOR'
                        ? "bg-amber-500/10 text-amber-600"
                        : "bg-muted text-muted-foreground"
                )}>
                  {project?.role ?? "Loading"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleGoToProjects}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                aria-label="Go to all projects"
              >
                <Home className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden min-h-0">
        {isMobile ? (
          viewMode === "code" ? (
            <div className="flex h-full min-h-0 flex-col bg-background px-3 pb-3 pt-3">
              <div className="h-full overflow-hidden rounded-2xl border border-border/50 bg-panel shadow-sm">
                <CodePanel
                  projectId={projectId}
                  updatedFiles={updatedFiles}
                  refreshToken={filesRefreshToken}
                  mobilePanelMode={mobilePanelMode}
                />
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              {mobilePanelMode !== "chat" && (
                <section className={cn(
                  "bg-background px-3 pt-3",
                  mobilePanelMode === "split" ? "min-h-0 basis-1/2 border-b border-border/50 pb-1" : "flex-1 pb-3"
                )}>
                  <div className="relative h-full overflow-hidden rounded-2xl border border-border/50 bg-panel shadow-sm">
                    <div className={cn("absolute inset-0 h-full", viewMode !== "preview" && "hidden")}>
                      <PreviewPanel
                        projectId={projectId}
                        runtimeError={runtimeError}
                        onDismiss={() => setRuntimeError(null)}
                        onFix={handleFixError}
                      />
                    </div>
                  </div>
                </section>
              )}

              {mobilePanelMode !== "workspace" && (
                <section className={cn(
                  "bg-background px-3 pb-3",
                  mobilePanelMode === "split" ? "min-h-0 basis-1/2 border-t border-border/30 pt-2" : "flex-1 pt-3"
                )}>
                  <div className="h-full overflow-hidden rounded-2xl border border-border/50 bg-panel shadow-sm">
                    <ChatPanel
                      messages={messages}
                      onSendMessage={handleSendMessage}
                      isStreaming={isStreaming}
                      isLoading={isLoadingHistory}
                      readOnly={project?.role === 'VIEWER'}
                    />
                  </div>
                </section>
              )}
            </div>
          )
        ) : (
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Chat Panel */}
            <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
              <div className="h-full border-r border-border/50 bg-panel">
                <ChatPanel
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  isStreaming={isStreaming}
                  isLoading={isLoadingHistory}
                  readOnly={project?.role === 'VIEWER'}
                />
              </div>
            </ResizablePanel>

            <ResizableHandle className="bg-border/50 hover:bg-primary/50 transition-colors" />

            {/* Code/Preview Panel */}
            <ResizablePanel defaultSize={65} minSize={50} maxSize={75}>
              <div className="h-full">
                <div className="h-full relative">
                  <div className={cn("h-full absolute inset-0", viewMode !== "code" && "hidden")}>
                    <CodePanel projectId={projectId} updatedFiles={updatedFiles} refreshToken={filesRefreshToken} />
                  </div>
                  <div className={cn("h-full absolute inset-0", viewMode !== "preview" && "hidden")}>
                    <PreviewPanel
                      projectId={projectId}
                      runtimeError={runtimeError}
                      onDismiss={() => setRuntimeError(null)}
                      onFix={handleFixError}
                    />
                  </div>
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>

      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
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
            <Button onClick={handleRenameSubmit} disabled={!renameName.trim() || renameName === project?.name}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div >
  );
}
