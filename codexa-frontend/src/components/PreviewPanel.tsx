import { useState, useEffect, useRef } from "react";
import { Play, Loader2, ExternalLink, RefreshCw, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { api, getPreviewUrlStorageKey } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

import { RuntimeErrorAlert, RuntimeError } from "@/components/RuntimeErrorAlert";

interface PreviewPanelProps {
  projectId: string;
  runtimeError: RuntimeError | null;
  onDismiss: () => void;
  onFix: (error: RuntimeError) => void;
}

export function PreviewPanel({ projectId, runtimeError, onDismiss, onFix }: PreviewPanelProps) {
  const isMobile = useIsMobile();
  const previewStorageKey = getPreviewUrlStorageKey(projectId);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(() => {
    return localStorage.getItem(previewStorageKey);
  });
  const [isDeploying, setIsDeploying] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewLoadProgress, setPreviewLoadProgress] = useState(0);
  const { toast } = useToast();
  const opensExternallyOnly = Boolean(
    previewUrl &&
    window.location.protocol === "https:" &&
    previewUrl.startsWith("http://")
  );

  useEffect(() => {
    const storedUrl = localStorage.getItem(previewStorageKey);
    if (storedUrl) {
      setPreviewUrl(storedUrl);
      // Auto-check if preview is ready by attempting to load it
      setIsPreviewLoading(true);
      setPreviewLoadProgress(5);
      // Poll to check if preview is actually ready
      pollPreviewReady(storedUrl);
    }
  }, [previewStorageKey]);

  useEffect(() => {
    if (previewUrl) {
      setIsPreviewLoading(true);
      setPreviewLoadProgress((current) => (current > 5 ? current : 8));
    } else {
      setIsPreviewLoading(false);
      setPreviewLoadProgress(0);
    }
  }, [previewUrl]);

  useEffect(() => {
    if (!isPreviewLoading) {
      setPreviewLoadProgress(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setPreviewLoadProgress((current) => {
        if (current >= 92) {
          return current;
        }

        const increment = current < 40 ? 10 : current < 70 ? 6 : 3;
        return Math.min(92, current + increment);
      });
    }, 400);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isPreviewLoading]);

  // Store previewUrl in localStorage when it changes
  useEffect(() => {
    if (previewUrl) {
      localStorage.setItem(previewStorageKey, previewUrl);
    } else {
      localStorage.removeItem(previewStorageKey);
    }
  }, [previewStorageKey, previewUrl]);

  const openPreviewInNewTab = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleDeploy = async () => {
    setIsDeploying(true);
    setIsPreviewLoading(true);
    setPreviewLoadProgress(12);

    try {
      const response = await api.deploy(projectId);
      setPreviewUrl(response.previewUrl);
      // Force iframe reload after deployment
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = response.previewUrl;
        }
        // Poll to check if preview is actually ready
        pollPreviewReady(response.previewUrl);
      }, 100);
      toast({
        title: "Deployment successful",
        description: "Your preview is now ready",
      });
    } catch (error) {
      toast({
        title: "Deployment failed",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
      setIsPreviewLoading(false);
    } finally {
      setIsDeploying(false);
    }
  };

  const pollPreviewReady = (url: string) => {
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes with 2-second intervals
    const pollInterval = 2000; // Check every 2 seconds

    const checkPreview = async () => {
      try {
        const response = await fetch(url, { mode: 'no-cors' });
        // With no-cors, we can't check response status, but if it doesn't throw, the URL is reachable
        console.log('Preview is ready');
        setIsPreviewLoading(false);
        setPreviewLoadProgress(100);
        return true;
      } catch (error) {
        attempts++;
        console.log(`Preview not ready yet, attempt ${attempts}/${maxAttempts}`);
        
        if (attempts >= maxAttempts) {
          console.log('Max polling attempts reached, clearing loading state');
          setIsPreviewLoading(false);
          setPreviewLoadProgress(100);
          return false;
        }
        
        // Continue polling
        setTimeout(checkPreview, pollInterval);
        return false;
      }
    };

    checkPreview();
  };


  const handleRefresh = () => {
    if (iframeRef.current) {
      setIsPreviewLoading(true);
      setPreviewLoadProgress(18);
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* URL Bar */}
      <div className="shrink-0 border-b border-border/50 bg-panel px-2 py-2 sm:px-3">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={!previewUrl}
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center h-8 px-2 rounded-md bg-muted/50 text-xs text-muted-foreground sm:px-3 sm:text-sm">
              <Globe className="w-3 h-3 mr-1.5 shrink-0 sm:w-3.5 sm:h-3.5 sm:mr-2" />
              <span className="truncate">
                {previewUrl || "Click 'Run Preview' to deploy"}
              </span>
            </div>

            {isPreviewLoading ? (
              <Progress value={previewLoadProgress} className="mt-1 h-0.5 bg-muted/50" />
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              onClick={handleDeploy}
              disabled={isDeploying}
              size="sm"
              className="h-7 px-2 bg-primary text-[11px] font-medium hover:bg-primary/90 sm:px-3 sm:text-xs"
            >
              {isDeploying ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin sm:mr-1.5" />
                  {!isMobile ? "Deploying" : null}
                </>
              ) : (
                <>
                  <Play className="h-3 w-3 sm:mr-1.5" />
                  {!isMobile ? "Run Preview" : null}
                </>
              )}
            </Button>
            {previewUrl && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.open(previewUrl, "_blank")}
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Open preview in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Preview Area */}
      <div className="relative flex-1 bg-[#1a1a1a]">
        {previewUrl ? (
          <iframe
            ref={iframeRef}
            key={previewUrl}
            src={previewUrl}
            className="w-full h-full border-0"
            title="Preview"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            onLoad={() => {
              console.log('Iframe loaded successfully');
              setPreviewLoadProgress(100);
              // Clear loading state immediately for faster display
              setIsPreviewLoading(false);
            }}
            onError={() => {
              console.log('Iframe load error');
              setIsPreviewLoading(false);
              setPreviewLoadProgress(0);
            }}
          />
        ) : isDeploying ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-8">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-muted/20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">Starting preview</p>
            <p className="mt-2 max-w-sm text-xs text-muted-foreground">
              We are preparing your preview environment. If it cannot be embedded here, the preview panel will switch to the external preview message instead.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-16 h-16 rounded-xl bg-muted/20 flex items-center justify-center mb-4">
              <Globe className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">
              No preview available yet
            </p>
          </div>
        )}

        {previewUrl && isPreviewLoading && (
          <div className="absolute inset-0 flex h-full flex-col items-center justify-center bg-background/92 text-center p-8 backdrop-blur-sm">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-muted/20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">Opening your preview</p>
            <p className="mt-2 max-w-sm text-xs text-muted-foreground">
              We are waiting for the preview app to finish booting so it can open directly inside this panel.
            </p>
          </div>
        )}
      </div>

      {/* Error Alert Overlay - Inside the Preview Panel */}
      <RuntimeErrorAlert
        error={runtimeError}
        onDismiss={onDismiss}
        onFix={onFix}
      />
    </div>
  );
}
