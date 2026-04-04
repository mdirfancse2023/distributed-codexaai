import { useState, useEffect, useRef } from "react";
import { Play, Loader2, ExternalLink, RefreshCw, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const { toast } = useToast();
  const opensExternallyOnly = Boolean(
    previewUrl &&
    window.location.protocol === "https:" &&
    previewUrl.startsWith("http://")
  );
  const usesSameOriginPreview = Boolean(
    previewUrl &&
    !opensExternallyOnly &&
    new URL(previewUrl, window.location.origin).origin === window.location.origin
  );

  useEffect(() => {
    setPreviewUrl(localStorage.getItem(previewStorageKey));
  }, [previewStorageKey]);

  useEffect(() => {
    if (previewUrl && !opensExternallyOnly) {
      setIsPreviewLoading(true);
    } else {
      setIsPreviewLoading(false);
    }
  }, [opensExternallyOnly, previewUrl]);

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

    try {
      const response = await api.deploy(projectId);
      setPreviewUrl(response.previewUrl);
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

  const handleRefresh = () => {
    if (opensExternallyOnly) {
      toast({
        title: "Preview requires HTTPS",
        description: "This saved preview still uses HTTP. Run Preview again after the new deployment to load it in the embedded panel.",
      });
      return;
    }

    if (iframeRef.current) {
      setIsPreviewLoading(true);
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* URL Bar */}
      <div className="h-12 shrink-0 flex items-center gap-1.5 px-2 border-b border-border/50 bg-panel sm:gap-2 sm:px-3">
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

        <div className="min-w-0 flex-1 flex items-center h-8 px-2 rounded-md bg-muted/50 text-xs text-muted-foreground sm:px-3 sm:text-sm">
          <Globe className="w-3 h-3 mr-1.5 shrink-0 sm:w-3.5 sm:h-3.5 sm:mr-2" />
          <span className="truncate">
            {previewUrl || "Click 'Run Preview' to deploy"}
          </span>
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

      {/* Preview Area */}
      <div className="relative flex-1 bg-[#1a1a1a]">
        {previewUrl && !opensExternallyOnly ? (
          <iframe
            ref={iframeRef}
            key={previewUrl}
            src={previewUrl}
            className="w-full h-full border-0"
            title="Preview"
            sandbox={usesSameOriginPreview ? "allow-scripts allow-forms allow-popups" : "allow-scripts allow-same-origin allow-forms allow-popups"}
            onLoad={() => setIsPreviewLoading(false)}
          />
        ) : previewUrl ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-8">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-muted/20">
              <ExternalLink className="h-8 w-8 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">Preview is running in a new tab</p>
            <p className="mt-2 max-w-sm text-xs text-muted-foreground">
              This workspace is served over HTTPS, but your preview URL is currently HTTP. Browsers block HTTP previews inside a secure iframe, so use the external preview tab for now.
            </p>
            <Button
              onClick={() => openPreviewInNewTab(previewUrl)}
              className="mt-5"
              size="sm"
            >
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Open Preview
            </Button>
          </div>
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
            <p className="text-sm font-medium text-foreground">Preview will be ready shortly</p>
            <p className="mt-2 max-w-sm text-xs text-muted-foreground">
              Your project is starting up. This can take a few seconds while the preview server finishes preparing.
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
