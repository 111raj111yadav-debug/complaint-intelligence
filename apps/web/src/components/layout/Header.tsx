import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Menu, User, ChevronDown, Check, LogOut, KeyRound } from "lucide-react";
import { Badge } from "../ui/Badge.js";
import { useAuth, DEMO_ACCOUNTS } from "../../lib/auth-context.js";
import { UserRole } from "../../types/index.js";

interface HeaderProps {
  onToggleSidebar: () => void;
  apiConnected?: boolean;
}

const getRoleBadgeVariant = (role: UserRole) => {
  switch (role) {
    case "ADMIN":
      return "danger";
    case "MANAGER":
      return "warning";
    case "AGENT":
      return "info";
    case "AUDITOR":
      return "neutral";
    default:
      return "neutral";
  }
};

const getPageTitle = (pathname: string): string => {
  if (pathname === "/" || pathname === "") return "Operations Dashboard";
  if (pathname.startsWith("/complaints")) return "Complaints";
  if (pathname.startsWith("/analysis")) return "AI Analysis";
  if (pathname.startsWith("/resolutions")) return "Resolution Engine";
  if (pathname.startsWith("/knowledge-base")) return "Knowledge Base";
  if (pathname.startsWith("/analytics")) return "Complaint Analytics";
  return "Complaint Management";
};

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  apiConnected = true,
}) => {
  const location = useLocation();
  const pageTitle = getPageTitle(location.pathname);
  const { user, switchDemoAccount, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    document.title = `${pageTitle} | Complaint Intel`;
  }, [pageTitle]);

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-10 px-4 md:px-8 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <button
          onClick={onToggleSidebar}
          type="button"
          aria-label="Toggle navigation menu"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 md:hidden focus:outline-hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-bold tracking-tight text-slate-900">
            Complaint Intel
          </span>
          <span className="text-slate-300 hidden sm:inline">/</span>
          <h1 className="text-sm font-semibold text-slate-700 hidden sm:inline">
            {pageTitle}
          </h1>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Compact Backend Status Indicator */}
        <div className="hidden lg:flex items-center space-x-2 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              apiConnected ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
            }`}
          />
          <span className="text-[11px] font-medium text-slate-600">
            {apiConnected ? "API Connected" : "Connecting..."}
          </span>
        </div>

        {/* User Profile & Demo RBAC Role Switcher */}
        <div className="relative">
          {user ? (
            <button
              onClick={() => setDropdownOpen((prev) => !prev)}
              type="button"
              className="flex items-center gap-2 p-1.5 pr-2.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-left"
            >
              <div className="w-7 h-7 rounded-md bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                {user.name.charAt(0)}
              </div>
              <div className="hidden sm:block">
                <div className="text-xs font-semibold text-slate-900 leading-tight">
                  {user.name}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant={getRoleBadgeVariant(user.role)}>
                    {user.role}
                  </Badge>
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
          ) : (
            <button
              onClick={() => switchDemoAccount("supervisor@complaint-intel.org")}
              className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-1.5"
            >
              <User className="w-3.5 h-3.5" />
              Sign In
            </button>
          )}

          {/* Account Dropdown */}
          {dropdownOpen && user && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-30 py-2 divide-y divide-slate-100">
                <div className="px-4 py-2">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Current Active Staff
                  </p>
                  <p className="text-xs font-bold text-slate-900 mt-1">
                    {user.name}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {user.email}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <Badge variant={getRoleBadgeVariant(user.role)}>
                      {user.role}
                    </Badge>
                    {user.department && (
                      <span className="text-[10px] text-slate-500">
                        • {user.department.name}
                      </span>
                    )}
                  </div>
                </div>

                  <div className="py-1">
                  <div className="px-4 py-1 flex flex-col gap-0.5">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Authenticated Account Switch</span>
                      <KeyRound className="w-3 h-3 text-slate-400" />
                    </div>
                    <span className="text-[10px] text-slate-400">
                      (Issues genuine server JWT via /auth/demo-login in dev)
                    </span>
                  </div>
                  {DEMO_ACCOUNTS.map((acc) => {
                    const isCurrent = acc.email === user.email;
                    return (
                      <button
                        key={acc.email}
                        onClick={() => {
                          switchDemoAccount(acc.email);
                          setDropdownOpen(false);
                        }}
                        className={`w-full px-4 py-2 text-left hover:bg-slate-50 transition-colors flex items-start justify-between ${
                          isCurrent ? "bg-indigo-50/50" : ""
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-slate-800">
                              {acc.name}
                            </span>
                            <Badge variant={getRoleBadgeVariant(acc.role)}>
                              {acc.role}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                            {acc.description}
                          </p>
                        </div>
                        {isCurrent && (
                          <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-1" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="py-1 px-2">
                  <button
                    onClick={() => {
                      logout();
                      setDropdownOpen(false);
                    }}
                    className="w-full px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
