import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, Mail, Bot, User, Lock, AlertCircle } from "lucide-react";
import { api, setAuthToken, setUserInfo } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Signup() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const navigate = useNavigate();
    const { toast } = useToast();

    useEffect(() => {
        document.title = "Codexa AI by Md Irfan";
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name || !email || !password) {
            setFormError("Fill in your name, email, and password to create an account.");
            return;
        }

        setFormError(null);
        setIsLoading(true);

        try {
            const response = await api.signup({ name, username: email, password });
            setAuthToken(response.token);
            setUserInfo(response.user);
            toast({
                title: "Welcome!",
                description: "Account created successfully",
            });
            navigate("/projects", { replace: true });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Could not create account";
            setFormError(message || "Your details could not be verified. Please check them and try again.");
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
                        <div className="flex flex-col items-center justify-center mb-3 sm:mb-5">
                            <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary/20 mb-1.5 sm:h-14 sm:w-14">
                                <Bot className="h-6 w-6 text-primary sm:h-7 sm:w-7" />
                            </div>
                            <span className="text-sm font-medium text-primary/80">Made by Md Irfan</span>
                        </div>
                        <h1 className="text-2xl font-semibold text-foreground mb-2">Create an account</h1>
                        <p className="text-muted-foreground text-sm">Start building with AI-powered development</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {formError && (
                            <Alert className="border-destructive/30 bg-destructive/8 text-foreground">
                                <AlertCircle className="h-4 w-4 text-destructive" />
                                <AlertTitle>Unable to create account</AlertTitle>
                                <AlertDescription>{formError}</AlertDescription>
                            </Alert>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-sm font-medium text-foreground">
                                Full Name
                            </Label>
                            <div className="relative">
                                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="name"
                                    type="text"
                                    placeholder="John Doe"
                                    value={name}
                                    onChange={(e) => {
                                        setName(e.target.value);
                                        if (formError) setFormError(null);
                                    }}
                                    className="pl-10 h-12 bg-muted/50 border-border/50 focus:border-primary rounded-xl"
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

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
                                    Creating account...
                                </>
                            ) : (
                                "Create account"
                            )}
                        </Button>
                    </form>

                    <p className="text-center text-sm text-muted-foreground mt-6">
                        Already have an account?{" "}
                        <Link to="/login" className="text-primary hover:underline font-medium">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
