import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AUTH_STATE_CHANGED_EVENT, clearAuthState, isAuthenticated } from "@/lib/api";

export function useProtectedSession() {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(() => isAuthenticated());

  useEffect(() => {
    const syncSession = () => {
      const nextAuthenticated = isAuthenticated();
      setAuthenticated(nextAuthenticated);

      if (!nextAuthenticated) {
        clearAuthState(false);
        navigate("/login", { replace: true });
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncSession();
      }
    };

    syncSession();

    window.addEventListener(AUTH_STATE_CHANGED_EVENT, syncSession);
    window.addEventListener("focus", syncSession);
    window.addEventListener("storage", syncSession);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener(AUTH_STATE_CHANGED_EVENT, syncSession);
      window.removeEventListener("focus", syncSession);
      window.removeEventListener("storage", syncSession);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [navigate]);

  return authenticated;
}
