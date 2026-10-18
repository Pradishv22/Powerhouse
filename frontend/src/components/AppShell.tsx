import { useState, type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  LineChart,
  Plug,
  Boxes,
  Calculator,
  Leaf,
  FileText,
  Zap,
  Menu,
  X,
  ShieldCheck,
  LogOut,
  LogIn,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "@/lib/authContext";

const BASE_NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/analytics", label: "Consumption Analytics", icon: LineChart },
  { to: "/appliances", label: "Appliance Analysis", icon: Plug },
  { to: "/big-data", label: "Big Data Processing", icon: null },
  { to: "/clustering", label: "Consumption Clustering", icon: Boxes },
  { to: "/bill-estimator", label: "Bill Estimator", icon: Calculator },
  { to: "/recommendations", label: "Recommendations", icon: Leaf },
  { to: "/reports", label: "Reports", icon: FileText },
] as const;

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-energy shadow-card">
        <Zap className="h-5 w-5 fill-current text-sidebar" />
      </span>
      <div>
        <p className="font-display text-lg font-semibold leading-none text-sidebar-foreground">
          PowerWise
        </p>
        <p className="text-[10px] uppercase tracking-widest text-sidebar-muted">Energy Analytics</p>
      </div>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin } = useAuth();

  const navItems = [
    ...BASE_NAV,
    ...(isAdmin ? [{ to: "/admin", label: "Admin & Health", icon: ShieldCheck }] : []),
  ];

  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
        const active = path === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-sidebar-accent text-sidebar-foreground"
                : "text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            }`}
          >
            {item.icon && <item.icon className={`h-4 w-4 ${active ? "text-success" : ""}`} />}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserSection() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate({ to: "/login" });
  };

  if (!isAuthenticated) {
    return (
      <div className="mt-auto rounded-xl border border-sidebar-border bg-sidebar-accent/30 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-sidebar-muted">Not signed in</span>
          <Link
            to="/login"
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            <LogIn className="h-3.5 w-3.5" /> Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-auto space-y-3">
      <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/30 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-xs font-bold text-primary">
              <UserIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-sidebar-foreground">{user?.name}</p>
              <p className="truncate text-[10px] text-sidebar-muted">{user?.email}</p>
            </div>
          </div>
          <span
            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
              user?.role === "admin" ? "bg-primary/20 text-primary" : "bg-success-soft text-success"
            }`}
          >
            {user?.role === "admin" ? "ADMIN" : "USER"}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-sidebar-border py-1.5 text-xs font-medium text-sidebar-muted transition hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign Out
        </button>
      </div>

      <div className="rounded-xl border border-sidebar-border p-2.5 text-[11px] text-sidebar-muted">
        <div className="flex items-center gap-1.5 text-success">
          <span className="h-2 w-2 rounded-full bg-success" />
          <span className="font-medium text-sidebar-foreground">Flask API Connected</span>
        </div>
        <p className="mt-1 text-[10px] text-sidebar-muted">RBAC & Sessions Active</p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen w-full">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 bg-sidebar p-5 lg:flex">
        <Logo />
        <NavLinks />
        <UserSection />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between bg-sidebar px-4 py-3 lg:hidden">
          <Logo />
          <button
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className="rounded-lg p-2 text-sidebar-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-0 flex h-full w-72 flex-col gap-6 bg-sidebar p-5">
              <div className="flex items-center justify-between">
                <Logo />
                <button
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                  className="text-sidebar-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <NavLinks onNavigate={() => setOpen(false)} />
              <UserSection />
            </div>
          </div>
        )}
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
