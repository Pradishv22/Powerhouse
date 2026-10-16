import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Zap, Lock, Mail, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/authContext";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — PowerWise" },
      {
        name: "description",
        content: "Sign in to access your electricity consumption analytics and reports.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      await login(email.trim(), password);
      // Navigate to dashboard
      navigate({ to: "/" });
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to log in. Please check your credentials.",
      );
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (userEmail: string, userPass: string) => {
    setEmail(userEmail);
    setPassword(userPass);
    setError("");
  };

  return (
    <div className="flex min-h-[85vh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-energy shadow-card">
            <Zap className="h-6 w-6 fill-current text-sidebar" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-foreground">
            Welcome to PowerWise
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign in to access household electricity analytics and big data processing
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2.5 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-xl border border-input bg-background py-2.5 pl-10 pr-3.5 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-input bg-background py-2.5 pl-10 pr-3.5 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow transition hover:opacity-95 disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Quick Demo Credentials Box for College Review / Viva */}
          <div className="mt-6 rounded-xl border border-sidebar-border bg-sidebar p-3.5 text-xs text-sidebar-muted">
            <div className="flex items-center gap-1.5 font-semibold text-sidebar-foreground">
              <ShieldCheck className="h-4 w-4 text-success" />
              <span>Viva Demo Credentials</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed">
              Click below to auto-fill verified testing accounts:
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fillCredentials("student@college.edu", "Password123!")}
                className="rounded-lg bg-sidebar-accent px-2.5 py-1 text-[11px] font-medium text-sidebar-foreground transition hover:bg-sidebar-accent/80"
              >
                Regular User (Student)
              </button>
              <button
                type="button"
                onClick={() => fillCredentials("admin@powerwise.local", "Admin@PowerWise2026")}
                className="rounded-lg bg-sidebar-accent px-2.5 py-1 text-[11px] font-medium text-sidebar-foreground transition hover:bg-sidebar-accent/80"
              >
                Admin User
              </button>
            </div>
          </div>

          <div className="mt-5 text-center text-xs text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/register" className="font-semibold text-primary hover:underline">
              Register here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
