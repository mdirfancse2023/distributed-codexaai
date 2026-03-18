import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, Lock, Mail, Bot, AlertCircle } from "lucide-react";
import { api, setAuthToken, setUserInfo } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";

export function LoginModal() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      setFormError("Enter both email and password to continue.");
      return;
    }

    setFormError(null);
    setIsLoading(true);

    try {
      const response = await api.login({ username: email, password });
      setAuthToken(response.token);
      if (response.user) {
        setUserInfo(response.user);
      }
      toast({
        title: "Welcome back!",
        description: "Successfully logged in",
      });
      navigate("/projects", { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid credentials";
      setFormError(message || "The email or password you entered is invalid.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative isolate flex min-h-[100svh] items-start justify-center bg-background px-4 pb-6 pt-[max(env(safe-area-inset-top),0.5rem)] sm:items-center sm:py-8">
      {/* Background gradient */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/3 left-1/3 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      </div>
      <div className="relative z-10 w-full max-w-md">
        {/* Card */}
        <div className="relative bg-card border border-border/50 rounded-2xl p-5 pt-12 shadow-2xl sm:p-8 sm:pt-8">
          <div className="absolute right-3 top-3 sm:right-4 sm:top-4">
            <ThemeToggle />
          </div>
          {/* Logo */}
          <div className="text-center mb-5 sm:mb-8">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary/20 mb-3 sm:mb-5 sm:h-14 sm:w-14">
              <Bot className="h-6 w-6 text-primary sm:h-7 sm:w-7" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground mb-2">Welcome to Codexa AI</h1>
            <p className="text-muted-foreground text-sm">Sign in to continue building</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {formError && (
              <Alert className="border-destructive/30 bg-destructive/8 text-foreground">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <AlertTitle>Unable to sign in</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  className="pl-10 h-12 bg-muted/50 border-border/50 focus:border-primary rounded-xl"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  className="pl-10 h-12 bg-muted/50 border-border/50 focus:border-primary rounded-xl"
                  disabled={isLoading}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl text-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Don't have an account?{" "}
            <Link to="/signup" className="text-primary hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
