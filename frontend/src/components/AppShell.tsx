import { useState, type FormEvent, type ReactNode } from "react";
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
  Database,
  Cpu,
  Activity,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";
import { useAuth } from "@/lib/authContext";

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-energy shadow-card">
        <Zap className="h-5 w-5 fill-current text-sidebar" />
      </span>
      <div>
        <p className="font-display text-lg font-semibold leading-none text-sidebar-foreground">
          PowerWise 2.0
        </p>
        <p className="text-[10px] uppercase tracking-widest text-sidebar-muted">
          Energy Intelligence
        </p>
      </div>
    </Link>
  );
}

function RoleBadge({ role }: { role?: string }) {
  const norm = (role || "user").toLowerCase();
  if (norm === "admin") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-purple-500/30 bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-400">
        <ShieldCheck className="h-3 w-3" /> Administrator
      </span>
    );
  }
  if (norm === "analyst") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-400">
        <Activity className="h-3 w-3" /> Energy Analyst
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
      <Zap className="h-3 w-3" /> Household User
    </span>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, isAdmin, isAnalyst } = useAuth();

  // Role-specific navigation arrays complying with Section 4 specifications
  const householdNav = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/appliances", label: "My Appliances", icon: Plug },
    { to: "/analytics", label: "My Energy Usage", icon: LineChart },
    { to: "/bill-estimator", label: "Bill & Savings", icon: Calculator },
    { to: "/recommendations", label: "Recommendations", icon: Leaf },
    { to: "/reports", label: "My Reports", icon: FileText },
    { to: "/big-data", label: "My Datasets", icon: Database },
  ] as const;

  const analystNav = [
    { to: "/", label: "Analyst Dashboard", icon: LayoutDashboard },
    { to: "/big-data", label: "Authorized Datasets", icon: Database },
    { to: "/analytics", label: "Consumption Analytics", icon: LineChart },
    { to: "/appliances", label: "Appliance Comparison", icon: Plug },
    { to: "/clustering", label: "Clustering", icon: Boxes },
    { to: "/reports", label: "Reports", icon: FileText },
  ] as const;

  const adminNav = [
    { to: "/admin", label: "Admin Overview", icon: ShieldCheck },
    { to: "/admin", label: "User Management", icon: UserIcon },
    { to: "/big-data", label: "Dataset Management", icon: Database },
    { to: "/analytics", label: "Processing Jobs", icon: Cpu },
    { to: "/appliances", label: "Appliances Catalog", icon: Plug },
    { to: "/reports", label: "Audit & Reports", icon: FileSpreadsheet },
  ] as const;

  const activeNav = isAdmin ? adminNav : isAnalyst ? analystNav : householdNav;

  return (
    <nav className="flex flex-col gap-1">
      <div className="mb-2 px-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
          {isAdmin ? "Admin Controls" : isAnalyst ? "Analyst Workspace" : "Household Energy"}
        </span>
      </div>
      {activeNav.map((item, idx) => {
        const active = path === item.to;
        return (
          <Link
            key={`${item.to}-${idx}`}
            to={item.to}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
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

function ProfileModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user, updateProfile, changePassword } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [currPassword, setCurrPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [nameMsg, setNameMsg] = useState("");
  const [nameErr, setNameErr] = useState("");
  const [nameLoading, setNameLoading] = useState(false);

  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  if (!isOpen) return null;

  const handleUpdateName = async (e: FormEvent) => {
    e.preventDefault();
    setNameMsg("");
    setNameErr("");
    setNameLoading(true);
    try {
      await updateProfile(name);
      setNameMsg("Profile name updated successfully.");
    } catch (err: unknown) {
      setNameErr(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setNameLoading(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwMsg("");
    setPwErr("");
    if (newPassword.length < 6) {
      setPwErr("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwErr("New passwords do not match.");
      return;
    }
    setPwLoading(true);
    try {
      await changePassword(currPassword, newPassword, confirmPassword);
      setPwMsg("Password updated successfully.");
      setCurrPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      setPwErr(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl text-card-foreground">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 border-b border-border pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
            <UserIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">User Profile & Security</h2>
            <div className="mt-1 flex items-center gap-2">
              <RoleBadge role={user?.role} />
              <span className="text-xs text-muted-foreground">ID: {user?.id.slice(0, 8)}...</span>
            </div>
          </div>
        </div>

        {/* Profile Name Form */}
        <form onSubmit={handleUpdateName} className="mt-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Basic Information</h3>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Registered Email</label>
            <input
              type="text"
              readOnly
              disabled
              value={user?.email || ""}
              className="mt-1 w-full rounded-xl border border-input bg-secondary px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">Full Name</label>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                disabled={nameLoading}
                className="shrink-0 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {nameLoading ? "Saving..." : "Update"}
              </button>
            </div>
          </div>
          {nameMsg && (
            <p className="text-xs text-success flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> {nameMsg}
            </p>
          )}
          {nameErr && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" /> {nameErr}
            </p>
          )}
        </form>

        {/* Password Change Form */}
        <form
          onSubmit={handleChangePassword}
          className="mt-6 border-t border-border pt-4 space-y-3"
        >
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <KeyRound className="h-4 w-4 text-primary" /> Change Password
          </h3>
          <div>
            <label className="text-xs font-medium text-foreground">Current Password</label>
            <input
              type="password"
              required
              value={currPassword}
              onChange={(e) => setCurrPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-foreground">New Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">Confirm New</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={pwLoading}
            className="w-full rounded-xl border border-primary bg-primary/10 py-2 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-50"
          >
            {pwLoading ? "Updating Password..." : "Change Password"}
          </button>
          {pwMsg && (
            <p className="text-xs text-success flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> {pwMsg}
            </p>
          )}
          {pwErr && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" /> {pwErr}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

function UserSection() {
  const { user, isAuthenticated, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
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
    <>
      <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
      <div className="mt-auto space-y-3">
        <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/30 p-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-xs font-bold text-primary">
                  <UserIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-sidebar-foreground">
                    {user?.name}
                  </p>
                  <p className="truncate text-[10px] text-sidebar-muted">{user?.email}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <RoleBadge role={user?.role} />
              <button
                onClick={() => setProfileOpen(true)}
                className="text-[11px] font-medium text-sidebar-muted hover:text-sidebar-foreground hover:underline"
              >
                Profile & Key
              </button>
            </div>
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
            <span className="font-medium text-sidebar-foreground">Flask API RBAC Active</span>
          </div>
          <p className="mt-1 text-[10px] text-sidebar-muted">Role-Enforced Endpoint Security</p>
        </div>
      </div>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

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
          <div className="flex items-center gap-2">
            <RoleBadge role={user?.role} />
            <button
              aria-label="Open menu"
              onClick={() => setOpen(true)}
              className="rounded-lg p-2 text-sidebar-foreground"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
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
