import { useState, useEffect, useCallback } from "react";
import { FileTree } from "./FileTree";
import { CodeEditor } from "./CodeEditor";
import { FileTabs } from "./FileTabs";
import { api, FileNode, OPEN_TABS_KEY, ACTIVE_TAB_KEY } from "@/lib/api";
import { useIsMobile } from "@/hooks/use-mobile";

interface CodePanelProps {
  projectId: string;
  updatedFiles: Map<string, string>;
  refreshToken?: number;
  mobilePanelMode?: "split" | "workspace" | "chat";
}

// Helper to find a file by path in the tree
function findFileInTree(files: FileNode[], targetPath: string): boolean {
  for (const node of files) {
    if (node.path === targetPath) return true;
    if (node.children && findFileInTree(node.children, targetPath)) return true;
  }
  return false;
}

function flattenFileTree(files: FileNode[]): { path: string }[] {
  const paths: { path: string }[] = [];
  const walk = (nodes: FileNode[]) => {
    for (const node of nodes) {
      if (node.type === "file") {
        paths.push({ path: node.path });
      }
      if (node.children) walk(node.children);
    }
  };
  walk(files);
  return paths;
}

function buildFileTree(paths: { path: string }[]): FileNode[] {
  const root: FileNode[] = [];
  const nodeMap = new Map<string, FileNode>();

  const sortedPaths = [...paths].sort((a, b) => a.path.localeCompare(b.path));

  for (const { path } of sortedPaths) {
    const parts = path.split("/");
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (nodeMap.has(currentPath)) continue;

      const isFile = i === parts.length - 1;
      const node: FileNode = {
        name: part,
        path: currentPath,
        type: isFile ? "file" : "directory",
        children: isFile ? undefined : [],
      };

      nodeMap.set(currentPath, node);

      if (parentPath) {
        const parent = nodeMap.get(parentPath);
        if (parent && parent.children) {
          parent.children.push(node);
        }
      } else {
        root.push(node);
      }
    }
  }

  const sortNodes = (nodes: FileNode[]) => {
    nodes.sort((a, b) => {
      if (a.type === "directory" && b.type === "file") return -1;
      if (a.type === "file" && b.type === "directory") return 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((node) => {
      if (node.children) sortNodes(node.children);
    });
  };

  sortNodes(root);
  return root;
}

// Storage key helpers
const getTabsKey = (projectId: string) => `${OPEN_TABS_KEY}_${projectId}`;
const getActiveTabKey = (projectId: string) => `${ACTIVE_TAB_KEY}_${projectId}`;

export function CodePanel({ projectId, updatedFiles, refreshToken, mobilePanelMode = "split" }: CodePanelProps) {
  const isMobile = useIsMobile();
  const [files, setFiles] = useState<FileNode[]>([]);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [isLoadingTree, setIsLoadingTree] = useState(true);
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  // Load tabs from localStorage
  useEffect(() => {
    const savedTabs = localStorage.getItem(getTabsKey(projectId));
    const savedActiveTab = localStorage.getItem(getActiveTabKey(projectId));
    
    if (savedTabs) {
      try {
        const tabs = JSON.parse(savedTabs);
        if (Array.isArray(tabs) && tabs.length > 0) {
          setOpenTabs(tabs);
          setActiveTab(savedActiveTab || tabs[0]);
          return;
        }
      } catch (e) {
        console.error("Failed to parse saved tabs:", e);
      }
    }
  }, [projectId]);

  // Save tabs to localStorage whenever they change
  useEffect(() => {
    if (openTabs.length > 0) {
      localStorage.setItem(getTabsKey(projectId), JSON.stringify(openTabs));
    } else {
      localStorage.removeItem(getTabsKey(projectId));
    }
  }, [openTabs, projectId]);

  // Save active tab to localStorage
  useEffect(() => {
    if (activeTab) {
      localStorage.setItem(getActiveTabKey(projectId), activeTab);
    } else {
      localStorage.removeItem(getActiveTabKey(projectId));
    }
  }, [activeTab, projectId]);

  // Load file tree
  useEffect(() => {
    const loadFiles = async () => {
      setIsLoadingTree(true);
      try {
        const fileTree = await api.getFiles(projectId);
        setFiles(fileTree);
        
        // If no tabs are open, default to pages/Index.tsx
        if (openTabs.length === 0) {
          const defaultPaths = ["src/pages/Index.tsx", "pages/Index.tsx"];
          for (const defaultPath of defaultPaths) {
            if (findFileInTree(fileTree, defaultPath)) {
              setOpenTabs([defaultPath]);
              setActiveTab(defaultPath);
              break;
            }
          }
        }
      } catch (error) {
        console.error("Failed to load files:", error);
      } finally {
        setIsLoadingTree(false);
      }
    };

    loadFiles();
  }, [projectId, refreshToken]);

  // Refresh active tab content after updates complete
  useEffect(() => {
    if (!activeTab) return;

    if (updatedFiles.has(activeTab)) {
      setFileContent(updatedFiles.get(activeTab)!);
      return;
    }

    const loadContent = async () => {
      setIsLoadingFile(true);
      try {
        const content = await api.getFileContent(projectId, activeTab);
        setFileContent(content);
      } catch (error) {
        console.error("Failed to load file:", error);
        setFileContent("// Error loading file");
      } finally {
        setIsLoadingFile(false);
      }
    };

    loadContent();
  }, [projectId, activeTab, refreshToken, updatedFiles]);

  // Load file content when active tab changes
  useEffect(() => {
    if (!activeTab) {
      setFileContent("");
      return;
    }

    // Check if we have an updated version from streaming
    if (updatedFiles.has(activeTab)) {
      setFileContent(updatedFiles.get(activeTab)!);
      return;
    }

    const loadContent = async () => {
      setIsLoadingFile(true);
      try {
        const content = await api.getFileContent(projectId, activeTab);
        setFileContent(content);
      } catch (error) {
        console.error("Failed to load file:", error);
        setFileContent("// Error loading file");
      } finally {
        setIsLoadingFile(false);
      }
    };

    loadContent();
  }, [projectId, activeTab, updatedFiles]);

  // Update content when streaming updates arrive for active file
  useEffect(() => {
    if (activeTab && updatedFiles.has(activeTab)) {
      setFileContent(updatedFiles.get(activeTab)!);
    }
  }, [activeTab, updatedFiles]);

  // Merge updated files into tree immediately
  useEffect(() => {
    if (updatedFiles.size === 0) return;

    setFiles((prevFiles) => {
      const existingPaths = flattenFileTree(prevFiles).map((p) => p.path);
      const updatedPaths = Array.from(updatedFiles.keys());
      const allPaths = Array.from(new Set([...existingPaths, ...updatedPaths])).map((p) => ({ path: p }));
      return buildFileTree(allPaths);
    });
  }, [updatedFiles]);

  const handleSelectFile = useCallback((path: string) => {
    // Add to tabs if not already open
    if (!openTabs.includes(path)) {
      setOpenTabs((prev) => [...prev, path]);
    }
    setActiveTab(path);
  }, [openTabs]);

  const handleCloseTab = useCallback((path: string) => {
    setOpenTabs((prev) => {
      const newTabs = prev.filter((t) => t !== path);
      
      // If closing active tab, switch to another tab
      if (activeTab === path) {
        const closingIndex = prev.indexOf(path);
        const newActiveIndex = Math.min(closingIndex, newTabs.length - 1);
        setActiveTab(newTabs[newActiveIndex] || null);
      }
      
      return newTabs;
    });
  }, [activeTab]);

  const handleSelectTab = useCallback((path: string) => {
    setActiveTab(path);
  }, []);

  return (
    <div className="flex h-full">
      {/* File Tree */}
      {(!isMobile || mobilePanelMode !== "chat") && (
      <div className={`${isMobile ? (mobilePanelMode === "split" ? "w-28" : "w-full") : "w-56"} shrink-0 overflow-y-auto border-r border-border/50 bg-panel`}>
        <div className="panel-header">
          <span className="text-sm font-medium">Files</span>
        </div>
        <FileTree
          files={files}
          selectedPath={activeTab}
          onSelectFile={handleSelectFile}
          isLoading={isLoadingTree}
        />
      </div>
      )}

      {/* Code Editor with Tabs */}
      {(!isMobile || mobilePanelMode !== "workspace") && (
      <div className="flex-1 flex flex-col min-w-0">
        {/* File Tabs */}
        <FileTabs
          openTabs={openTabs}
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          onCloseTab={handleCloseTab}
        />
        
        {/* Editor */}
        <div className="flex-1 overflow-hidden">
          <CodeEditor
            content={fileContent}
            filePath={activeTab}
            isLoading={isLoadingFile}
          />
        </div>
      </div>
      )}
    </div>
  );
}
