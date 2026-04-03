import { ChatMessage, CheckoutResponse, DeployResponse, FileNode, LoginCredentials, LoginResponse, PortalResponse, ProjectSummaryResponse, ProjectRequest, ProjectResponse, ProjectMember, ProjectRole, SignupRequest, SubscriptionResponse, AuthResponse } from "./types";

const BASE_URL = import.meta.env.VITE_API_URL || "https://api.34.10.18.19.sslip.io";

export const getAuthToken = () => localStorage.getItem("auth_token");

export const setAuthToken = (token: string) => localStorage.setItem("auth_token", token);

export const removeAuthToken = () => localStorage.removeItem("auth_token");

export const isAuthenticated = () => !!getAuthToken();

const getAuthHeaders = (): HeadersInit => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const parseErrorResponse = async (response: Response, fallbackMessage: string) => {
  const rawText = await response.text();
  if (!rawText) return fallbackMessage;

  try {
    const parsed = JSON.parse(rawText) as { message?: string; error?: string; status?: string };
    const backendMessage = parsed.message || parsed.error || rawText;

    if (response.status === 401) {
      return "Invalid email or password.";
    }

    if (response.status === 409) {
      return "An account with these details already exists.";
    }

    if (response.status === 400) {
      if (backendMessage.toLowerCase().includes("password")) {
        return "Enter a valid password and try again.";
      }
      if (backendMessage.toLowerCase().includes("email") || backendMessage.toLowerCase().includes("username")) {
        return "Enter a valid email address and try again.";
      }
      return "Please check your details and try again.";
    }

    return backendMessage;
  } catch {
    if (response.status === 401) return "Invalid email or password.";
    return rawText || fallbackMessage;
  }
};

// User info storage
export const setUserInfo = (user: { id: number; username: string; name: string }) => {
  localStorage.setItem("user_info", JSON.stringify(user));
};

export const getUserInfo = (): { id: number; username: string; name: string } | null => {
  const userInfo = localStorage.getItem("user_info");
  return userInfo ? JSON.parse(userInfo) : null;
};

export const removeUserInfo = () => localStorage.removeItem("user_info");

// LocalStorage keys
export const PREVIEW_URL_KEY = "preview_url";
export const OPEN_TABS_KEY = "open_tabs";
export const ACTIVE_TAB_KEY = "active_tab";

export const getPreviewUrlStorageKey = (projectId: string) => `${PREVIEW_URL_KEY}:${projectId}`;

// API response format for files endpoint
interface FilesApiResponse {
  files: { path: string }[];
}

// Convert flat file paths to nested tree structure
function buildFileTree(paths: { path: string }[]): FileNode[] {
  if (!paths || !Array.isArray(paths)) {
    console.error('buildFileTree: paths is not an array:', paths);
    return [];
  }

  const root: FileNode[] = [];
  const nodeMap = new Map<string, FileNode>();

  // Sort paths to ensure directories come before their children
  const sortedPaths = [...paths].sort((a, b) => a.path.localeCompare(b.path));

  for (const { path } of sortedPaths) {
    const parts = path.split("/");
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      // Skip if node already exists
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

  // Sort each level: directories first, then alphabetically
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

export const api = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await fetch(`${BASE_URL}/api/v1/account/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await parseErrorResponse(response, "Login failed");
      throw new Error(error || "Login failed");
    }

    return response.json();
  },

  async signup(data: SignupRequest): Promise<AuthResponse> {
    const response = await fetch(`${BASE_URL}/api/v1/account/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await parseErrorResponse(response, "Signup failed");
      throw new Error(error || "Signup failed");
    }

    return response.json();
  },

  async getCurrentSubscription(): Promise<SubscriptionResponse | null> {
    try {
      const response = await fetch(`${BASE_URL}/api/v1/account/subscription`, {
        headers: { ...getAuthHeaders() },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to fetch subscription");
      }

      return response.json();
    } catch (error) {
      console.error("Failed to fetch subscription:", error);
      return null;
    }
  },

  async createCheckoutSession(planId: number): Promise<CheckoutResponse> {
    const response = await fetch(`${BASE_URL}/api/v1/account/payments/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ planId }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || "Failed to create checkout session");
    }

    return response.json();
  },

  async openBillingPortal(): Promise<PortalResponse> {
    const response = await fetch(`${BASE_URL}/api/v1/account/payments/portal`, {
      method: "POST",
      headers: { ...getAuthHeaders() },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || "Failed to open billing portal");
    }

    return response.json();
  },

  async getFiles(projectId: string): Promise<FileNode[]> {
    const response = await fetch(`${BASE_URL}/api/v1/workspace/projects/${projectId}/files`, {
      headers: { ...getAuthHeaders() },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch files");
    }

    const data = await response.json();
    console.log('Files response:', data);

    // Handle different response formats
    let filePaths: { path: string }[] = [];

    if (Array.isArray(data)) {
      // If data is directly an array of file objects
      filePaths = data.map(item => ({ path: item.path || item }));
    } else if (data.files && Array.isArray(data.files)) {
      // If data has a 'files' property
      filePaths = data.files;
    } else {
      console.error('Unexpected files response format:', data);
      return [];
    }

    return buildFileTree(filePaths);
  },

  async getFileContent(projectId: string, path: string): Promise<string> {
    const response = await fetch(
      `${BASE_URL}/api/v1/workspace/projects/${projectId}/files/content?path=${path}`,
      {
        headers: { ...getAuthHeaders() },
      }
    );

    if (!response.ok) {
      console.error(`Error fetching file: ${response.status} ${response.statusText}`);
      throw new Error("Failed to fetch file content");
    }

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const data = await response.json();
      return typeof data === "string" ? data : data.content;
    }

    return response.text();
  },

  async deploy(projectId: string): Promise<DeployResponse> {
    const response = await fetch(`${BASE_URL}/api/v1/workspace/projects/${projectId}/deploy`, {
      method: "POST",
      headers: { ...getAuthHeaders() },
    });

    if (!response.ok) {
      throw new Error("Deployment failed");
    }

    return response.json();
  },

  async getProjects(): Promise<ProjectSummaryResponse[]> {
    const response = await fetch(`${BASE_URL}/api/v1/workspace/projects`, {
      headers: { ...getAuthHeaders() },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch projects");
    }

    return response.json();
  },

  async createProject(name: string): Promise<ProjectSummaryResponse> {
    const response = await fetch(`${BASE_URL}/api/v1/workspace/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      throw new Error("Failed to create project");
    }

    return response.json();
  },

  async getProject(id: string): Promise<ProjectResponse> {
    const response = await fetch(`${BASE_URL}/api/v1/workspace/projects/${id}`, {
      headers: { ...getAuthHeaders() },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch project ${id}:`, response.status, errorText);
      throw new Error(`Failed to fetch project: ${response.status} ${errorText}`);
    }

    return response.json();
  },

  async updateProject(id: string, name: string): Promise<ProjectResponse> {
    const response = await fetch(`${BASE_URL}/api/v1/workspace/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      throw new Error("Failed to update project");
    }

    return response.json();
  },

  async deleteProject(id: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/api/v1/workspace/projects/${id}`, {
      method: "DELETE",
      headers: { ...getAuthHeaders() },
    });

    if (!response.ok) {
      throw new Error("Failed to delete project");
    }
  },

  async downloadProjectZip(id: string): Promise<Blob> {
    const response = await fetch(`${BASE_URL}/api/v1/workspace/projects/${id}/files/download-zip`, {
      headers: { ...getAuthHeaders() },
    });

    if (!response.ok) {
      throw new Error("Failed to download project");
    }

    return response.blob();
  },

  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    const response = await fetch(`${BASE_URL}/api/v1/workspace/projects/${projectId}/members`, {
      headers: { ...getAuthHeaders() },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch project members");
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((member) => ({
      userId: member.userId,
      username: member.username,
      name: member.name,
      role: member.role ?? member.projectRole,
      invitedAt: member.invitedAt,
    }));
  },

  async inviteMember(projectId: string, username: string, role: ProjectRole): Promise<ProjectMember | null> {
    const response = await fetch(`${BASE_URL}/api/v1/workspace/projects/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ username, role }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || "Failed to invite member");
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return null;
    }

    const member = await response.json();
    return {
      userId: member.userId,
      username: member.username,
      name: member.name,
      role: member.role ?? member.projectRole ?? role,
      invitedAt: member.invitedAt,
    };
  },

  async updateMemberRole(projectId: string, userId: number, role: ProjectRole): Promise<void> {
    const response = await fetch(`${BASE_URL}/api/v1/workspace/projects/${projectId}/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ role }),
    });

    if (!response.ok) {
      throw new Error("Failed to update member role");
    }
  },

  async removeMember(projectId: string, userId: number): Promise<void> {
    const response = await fetch(`${BASE_URL}/api/v1/workspace/projects/${projectId}/members/${userId}`, {
      method: "DELETE",
      headers: { ...getAuthHeaders() },
    });

    if (!response.ok) {
      throw new Error("Failed to remove member");
    }
  },

  async getChatHistory(projectId: string): Promise<ChatMessage[]> {
    const response = await fetch(`${BASE_URL}/api/v1/intelligence/chat/projects/${projectId}`, {
      headers: { ...getAuthHeaders() },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch chat history for project ${projectId}:`, response.status, errorText);
      // Return empty array instead of throwing error for chat history
      return [];
    }

    const data = await response.json();
    console.log('Chat history response:', data);
    return Array.isArray(data) ? data : [];
  },

  async streamChat(
    projectId: string,
    message: string,
    onChunk: (chunk: string) => void,
    onFile: (path: string, content: string) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ) {
    const controller = new AbortController();

    // Add timeout for the entire stream (5 minutes)
    const timeout = setTimeout(() => {
      controller.abort();
      onError(new Error("Request timeout - stream took too long"));
    }, 300000); // 5 minutes

    fetch(`${BASE_URL}/api/v1/intelligence/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ message, projectId }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Chat stream failed: ${response.status} ${errorText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader available");

        const decoder = new TextDecoder();

        // Buffers
        let sseBuffer = ""; // To handle split SSE lines
        let fullContentBuffer = ""; // To accumulate clean text for file regex
        //let lastProcessedIndex = 0; // Optimization for regex
        let hasReceivedData = false;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              console.log("✅ Stream completed successfully, hasReceivedData:", hasReceivedData);
              break;
            }

            hasReceivedData = true;
            const chunk = decoder.decode(value, { stream: true });
            console.log("📦 Received chunk:", chunk.substring(0, 100));
            sseBuffer += chunk;

            // Process line by line to handle SSE format (data: ...)
            const lines = sseBuffer.split("\n");
            sseBuffer = lines.pop() || "";

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine || !trimmedLine.startsWith("data:")) continue;

              const dataStr = trimmedLine.slice(5).trim();
              if (!dataStr) continue;

              try {
                // Parse JSON to get the real text with newlines preserved
                const parsed = JSON.parse(dataStr);

                // Check if this is an error event from backend
                if (parsed.error) {
                  console.error("❌ Backend error:", parsed.error);
                  throw new Error(parsed.error);
                }

                const eventObj = typeof parsed.event === "object" && parsed.event ? parsed.event : null;
                const eventTypeRaw = (parsed.type || parsed.eventType || eventObj?.type || parsed.event || "").toString();
                const eventType = eventTypeRaw.toLowerCase();

                let content = parsed.text || parsed.content || eventObj?.content || "";
                if (!content && parsed.message) content = parsed.message;

                if (!content) continue;

                // If backend provides typed events, wrap them so the stream parser can render them
                if (eventType) {
                  if (eventType === "thought" || eventType === "think") {
                    content = `<thought>${content}</thought>`;
                  } else if (eventType === "message") {
                    content = `<message>${content}</message>`;
                  } else if (eventType === "file_edit" || eventType === "file") {
                    const path = parsed.filePath || parsed.path || "";
                    content = path ? `<file path="${path}">${content}</file>` : `<file>${content}</file>`;
                  } else if (eventType === "tool_log" || eventType === "tool") {
                    const args = parsed.metadata || parsed.args || "";
                    content = args ? `<tool args="${args}">${content}</tool>` : `<tool>${content}</tool>`;
                  }
                }

                // Fallback: detect tool-style lines in plain text and wrap them for live rendering
                if (!eventType) {
                  const lines = content.split("\n");
                  const transformed = lines.map((line) => {
                    const trimmed = line.trim();
                    const readMatch = /^Read\s+(.+)$/i.exec(trimmed);
                    if (readMatch) {
                      const target = readMatch[1].trim();
                      return `<tool args="${target}">Read</tool>`;
                    }
                    const editedMatch = /^(Edited|Edit|Updated)\s+(.+)$/i.exec(trimmed);
                    if (editedMatch) {
                      const target = editedMatch[2].trim();
                      return `<file path="${target}">Edited</file>`;
                    }
                    const createdMatch = /^(Created|Added)\s+(.+)$/i.exec(trimmed);
                    if (createdMatch) {
                      const target = createdMatch[2].trim();
                      return `<file path="${target}">Created</file>`;
                    }
                    return line;
                  });
                  content = transformed.join("\n");
                }

                // 1. Send clean text to UI
                onChunk(content);

                // 2. Accumulate for file parsing (Same as before)
                fullContentBuffer += content;
                // ... (rest of regex logic) ...

              } catch (e) {
                console.error("Failed to parse SSE JSON:", e, "Line:", trimmedLine);
              }
            }
          }

          clearTimeout(timeout);
          onComplete();
        } catch (readError) {
          clearTimeout(timeout);
          console.error("Error reading stream:", readError);
          if (hasReceivedData) {
            // Partial success - we got some data
            onComplete();
          } else {
            throw readError;
          }
        }
      })
      .catch((error) => {
        clearTimeout(timeout);
        if (error.name !== "AbortError") {
          console.error("Stream error:", error);
          onError(error);
        }
      });

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }

};
