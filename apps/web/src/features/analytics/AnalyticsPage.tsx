import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  RefreshCw,
  Clock,
  AlertTriangle,
  TrendingUp,
  Users,
  HelpCircle,
  Sparkles,
  Lock,
  ShieldAlert,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Legend,
} from "recharts";
import { Card } from "../../components/ui/Card.js";
import { Badge } from "../../components/ui/Badge.js";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner.js";
import { ErrorMessage } from "../../components/ui/ErrorMessage.js";
import { EmptyState } from "../../components/ui/EmptyState.js";
import { fetchOperationalAnalytics } from "../../services/analytics-service.js";
import { OperationalAnalyticsData } from "../../types/index.js";
import { useAuth } from "../../lib/auth-context.js";

const CATEGORY_COLORS: Record<string, string> = {
  credit_card: "#6366f1", // indigo
  credit_reporting: "#3b82f6", // blue
  debt_collection: "#f59e0b", // amber
  mortgages_and_loans: "#10b981", // emerald
  retail_banking: "#8b5cf6", // violet
  general_inquiry: "#64748b", // slate
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#f59e0b",
  ANALYZED: "#3b82f6",
  IN_REVIEW: "#6366f1",
  RESOLVED: "#10b981",
  DISMISSED: "#94a3b8",
};

export const AnalyticsPage: React.FC = () => {
  const { switchDemoAccount } = useAuth();
  const [data, setData] = useState<OperationalAnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<"UNAUTHENTICATED" | "UNAUTHORIZED" | null>(null);
  const [range, setRange] = useState<"24h" | "7d" | "30d" | "all">("all");
  const [showFormulas, setShowFormulas] = useState<boolean>(false);

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAuthError(null);
    try {
      const result = await fetchOperationalAnalytics({ range });
      setData(result);
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : "Failed to load operational analytics.";
      if (
        err?.status === 401 ||
        msg.includes("AUTHENTICATION_REQUIRED") ||
        msg.includes("jwt") ||
        msg.includes("Not authenticated") ||
        msg.includes("Invalid token") ||
        msg.includes("Authentication required")
      ) {
        setAuthError("UNAUTHENTICATED");
      } else if (
        err?.status === 403 ||
        msg.includes("FORBIDDEN") ||
        msg.includes("Access denied") ||
        msg.includes("ACCOUNT_DEACTIVATED")
      ) {
        setAuthError("UNAUTHORIZED");
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  return (
    <div className="space-y-6">
      {/* Header and Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            Operational Analytics & SLA Intelligence
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time database aggregation of complaint volumes, operational
            SLA deadlines, and AI recommendation performance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Range Selector */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs shadow-xs">
            {(["24h", "7d", "30d", "all"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  range === r
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {r === "all" ? "All Time" : r.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            onClick={loadMetrics}
            disabled={loading}
            className="p-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg shadow-xs transition-colors"
            title="Refresh metrics"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600" : ""}`}
            />
          </button>

          <button
            onClick={() => setShowFormulas((prev) => !prev)}
            className={`px-3 py-1.5 border rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
              showFormulas
                ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Metric Definitions
          </button>
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      {/* Metric Definitions Modal / Banner */}
      {showFormulas && data && (
        <Card className="border-indigo-100 bg-indigo-50/40 p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                Metric Calculation Methodology & Formulas
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-700">
                {Object.entries(data.definitions).map(([key, formula]) => (
                  <div
                    key={key}
                    className="p-2.5 bg-white rounded-lg border border-indigo-100 shadow-2xs"
                  >
                    <span className="font-mono font-bold text-indigo-700 block text-[11px]">
                      {key}
                    </span>
                    <span className="text-slate-600 text-[11px] mt-0.5 block">
                      {formula}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => setShowFormulas(false)}
              className="text-slate-400 hover:text-slate-600 text-xs font-bold p-1"
            >
              ✕
            </button>
          </div>
        </Card>
      )}

      {loading && !data ? (
        <div className="py-24 flex flex-col items-center justify-center space-y-3">
          <LoadingSpinner size="lg" />
          <p className="text-xs text-slate-500 font-medium">
            Aggregating database analytics and SLA metrics...
          </p>
        </div>
      ) : authError === "UNAUTHENTICATED" ? (
        <Card className="p-8 text-center border-amber-200 bg-amber-50/40">
          <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            Authentication Required (HTTP 401)
          </h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto mt-1.5 leading-relaxed">
            Operational analytics and SLA metrics contain confidential complaint volumes and internal agent workload distributions. Please authenticate with a valid staff session to view these reports.
          </p>
          <div className="mt-5">
            <button
              onClick={() => switchDemoAccount("supervisor@complaint-intel.org")}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors inline-flex items-center gap-1.5"
            >
              Sign In as Operations Supervisor
            </button>
          </div>
        </Card>
      ) : authError === "UNAUTHORIZED" ? (
        <Card className="p-8 text-center border-rose-200 bg-rose-50/40">
          <div className="w-12 h-12 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            Access Restricted (HTTP 403 Forbidden)
          </h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto mt-1.5 leading-relaxed">
            Your current account role does not have authorization to access internal operational analytics. Required roles: ADMIN, MANAGER, AGENT, or AUDITOR.
          </p>
        </Card>
      ) : !data ? (
        <Card>
          <EmptyState
            icon={BarChart3}
            title="Analytics Data Unavailable"
            description="Unable to connect to operational metrics service."
          />
        </Card>
      ) : (
        <>
          {/* Key Metric KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <Card className="p-3.5 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Total Complaints
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-black text-slate-900">
                  {data.volume.totalComplaints}
                </span>
                <Badge variant="neutral">Volume</Badge>
              </div>
            </Card>

            <Card className="p-3.5 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Resolution Rate
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-black text-emerald-600">
                  {data.volume.totalComplaints > 0
                    ? `${(data.volume.resolutionRate * 100).toFixed(1)}%`
                    : "—"}
                </span>
                <span className="text-[11px] text-slate-400">
                  {data.volume.resolvedComplaints} of {data.volume.totalComplaints} resolved
                </span>
              </div>
            </Card>

            <Card className="p-3.5 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Overdue Complaints
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span
                  className={`text-2xl font-black ${
                    data.operations.overdueCount > 0
                      ? "text-rose-600"
                      : "text-slate-900"
                  }`}
                >
                  {data.operations.overdueCount}
                </span>
                <Badge
                  variant={
                    data.operations.overdueCount > 0 ? "danger" : "success"
                  }
                >
                  {data.operations.overdueCount > 0
                    ? `${(data.operations.overdueRate * 100).toFixed(0)}% breached`
                    : "0 breached"}
                </Badge>
              </div>
            </Card>

            <Card className="p-3.5 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Avg Assign Time
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                {(() => {
                  const val = data.operations.avgTimeToFirstAssignmentHours;
                  if (val === null || val === undefined || val === 0) {
                    return (
                      <span className="text-base font-bold text-slate-400">
                        No data yet
                      </span>
                    );
                  }
                  if (val < 0.1) {
                    return (
                      <span className="text-2xl font-black text-slate-900">
                        &lt; 0.1h
                      </span>
                    );
                  }
                  return (
                    <span className="text-2xl font-black text-slate-900">
                      {val.toFixed(1)}h
                    </span>
                  );
                })()}
                <Clock className="w-4 h-4 text-slate-400" />
              </div>
            </Card>

            <Card className="p-3.5 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Avg Resolution Time
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                {(() => {
                  const val = data.operations.avgTimeToResolutionHours;
                  if (val === null || val === undefined || val === 0) {
                    return (
                      <span className="text-base font-bold text-slate-400">
                        No data yet
                      </span>
                    );
                  }
                  if (val < 0.1) {
                    return (
                      <span className="text-2xl font-black text-slate-900">
                        &lt; 0.1h
                      </span>
                    );
                  }
                  return (
                    <span className="text-2xl font-black text-slate-900">
                      {val.toFixed(1)}h
                    </span>
                  );
                })()}
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
            </Card>

            <Card className="p-3.5 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Human Review Rate
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                {(() => {
                  const rate = data.aiPerformance.humanReviewRate;
                  const analyzed = data.volume.analyzedComplaints ?? 0;
                  const flagged = data.aiPerformance.humanReviewRequiredCount ?? 0;
                  if (rate === null || analyzed === 0) {
                    return (
                      <>
                        <span className="text-base font-bold text-slate-400">
                          No data yet
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Unanalyzed
                        </span>
                      </>
                    );
                  }
                  return (
                    <>
                      <span className="text-2xl font-black text-amber-600">
                        {(rate * 100).toFixed(0)}%
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {flagged} of {analyzed} flagged
                      </span>
                    </>
                  );
                })()}
              </div>
            </Card>
          </div>

          {/* Middle Row: Volume By Category & Status Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Distribution Bar Chart */}
            <Card className="p-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Complaint Volume by Product Category
                  </h3>
                  <p className="text-xs text-slate-500">
                    Classified complaints by product category ({data.volume.analyzedComplaints ?? data.volume.byCategory.reduce((acc, c) => acc + c.count, 0)} analyzed of {data.volume.totalComplaints} total)
                  </p>
                </div>
                <Badge variant="neutral">
                  {data.volume.byCategory.length === 1
                    ? "1 Active Category"
                    : `${data.volume.byCategory.length} Categories`}
                </Badge>
              </div>

              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.volume.byCategory}
                    margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="category"
                      tick={{ fontSize: 10 }}
                      interval={0}
                      tickFormatter={(val: string) => {
                        const labels: Record<string, string> = {
                          credit_card: "Credit Card",
                          credit_reporting: "Credit Reporting",
                          debt_collection: "Debt Collection",
                          mortgages_and_loans: "Mortgages & Loans",
                          retail_banking: "Retail Banking",
                          general_inquiry: "General Inquiry",
                        };
                        return labels[val] || val.replace(/_/g, " ").slice(0, 15);
                      }}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: any) => [`${value} complaints`, "Complaint Volume"]}
                      labelFormatter={(label) => {
                        const labels: Record<string, string> = {
                          credit_card: "Credit Card",
                          credit_reporting: "Credit Reporting",
                          debt_collection: "Debt Collection",
                          mortgages_and_loans: "Mortgages & Loans",
                          retail_banking: "Retail Banking",
                          general_inquiry: "General Inquiry",
                        };
                        return `Category: ${labels[String(label)] || String(label).replace(/_/g, " ")}`;
                      }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {data.volume.byCategory.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            CATEGORY_COLORS[entry.category] || "#6366f1"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Workflow Status Distribution Donut Chart */}
            <Card className="p-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Workflow State Breakdown
                  </h3>
                  <p className="text-xs text-slate-500">
                    Complaints across lifecycle stages (PENDING → ANALYZED → IN_REVIEW → RESOLVED)
                  </p>
                </div>
                <Badge variant="neutral">
                  {data.volume.totalComplaints} Total
                </Badge>
              </div>

              <div className="h-64 mt-4 flex items-center justify-center">
                {(() => {
                  const statusData = (data.volume.statusDistribution && data.volume.statusDistribution.length > 0
                    ? data.volume.statusDistribution
                    : [
                        { status: "PENDING", count: data.volume.openComplaints },
                        { status: "IN_REVIEW", count: data.volume.inReviewComplaints },
                        { status: "RESOLVED", count: data.volume.resolvedComplaints },
                        { status: "DISMISSED", count: data.volume.dismissedComplaints },
                      ]
                  )
                    .filter((item) => item.count > 0)
                    .map((item) => ({
                      name: item.status.replace(/_/g, " "),
                      statusKey: item.status,
                      value: item.count,
                    }));

                  return statusData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusData}
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {statusData.map((entry, index) => (
                            <Cell
                              key={`cell-status-${index}`}
                              fill={STATUS_COLORS[entry.statusKey] || "#94a3b8"}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any, name: any) => [
                            `${value} complaints (${((Number(value) / data.volume.totalComplaints) * 100).toFixed(1)}%)`,
                            name,
                          ]}
                        />
                        <Legend
                          verticalAlign="bottom"
                          iconType="circle"
                          wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-xs text-slate-400">
                      No status records available in selected range.
                    </p>
                  );
                })()}
              </div>
            </Card>
          </div>

          {/* Third Row: Operational Performance & Department Backlogs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Department Backlog & Overdue Chart */}
            <Card className="p-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Department Backlog & SLA Breaches
                  </h3>
                  <p className="text-xs text-slate-500">
                    Open complaint volume vs SLA overdue violations per department
                  </p>
                </div>
              </div>

              <div className="h-64 mt-4">
                {data.operations.departmentBacklog.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.operations.departmentBacklog}
                      margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="departmentCode"
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend
                        verticalAlign="top"
                        wrapperStyle={{ fontSize: "11px", paddingBottom: "10px" }}
                      />
                      <Bar
                        name="Open Backlog"
                        dataKey="openCount"
                        fill="#6366f1"
                        radius={[3, 3, 0, 0]}
                      />
                      <Bar
                        name="Overdue Breached"
                        dataKey="overdueCount"
                        fill="#ef4444"
                        radius={[3, 3, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    No active department backlog.
                  </div>
                )}
              </div>
            </Card>

            {/* AI Recommendation Feedback Evaluation */}
            <Card className="p-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    AI Recommendation Feedback & Quality
                  </h3>
                  <p className="text-xs text-slate-500">
                    Human reviewer feedback decision rates & rubric dimensions
                  </p>
                </div>
                <Badge variant="info">
                  {data.aiPerformance.feedbackCounts.total} Evaluated
                </Badge>
              </div>

              <div className="mt-4 space-y-4">
                {/* Feedback Rates Breakdown */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-100">
                    <span className="text-[11px] text-emerald-700 font-semibold uppercase block">
                      Accepted As-Is
                    </span>
                    <span className="text-lg font-black text-emerald-800">
                      {data.aiPerformance.feedbackAcceptanceRate !== null
                        ? `${(data.aiPerformance.feedbackAcceptanceRate * 100).toFixed(0)}%`
                        : "0%"}
                    </span>
                    <span className="text-[10px] text-emerald-600 block">
                      {data.aiPerformance.feedbackCounts.accepted} cases
                    </span>
                  </div>

                  <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-100">
                    <span className="text-[11px] text-blue-700 font-semibold uppercase block">
                      Modified
                    </span>
                    <span className="text-lg font-black text-blue-800">
                      {data.aiPerformance.feedbackModificationRate !== null
                        ? `${(data.aiPerformance.feedbackModificationRate * 100).toFixed(0)}%`
                        : "0%"}
                    </span>
                    <span className="text-[10px] text-blue-600 block">
                      {data.aiPerformance.feedbackCounts.modified} cases
                    </span>
                  </div>

                  <div className="p-2.5 bg-rose-50 rounded-lg border border-rose-100">
                    <span className="text-[11px] text-rose-700 font-semibold uppercase block">
                      Rejected
                    </span>
                    <span className="text-lg font-black text-rose-800">
                      {data.aiPerformance.feedbackRejectionRate !== null
                        ? `${(data.aiPerformance.feedbackRejectionRate * 100).toFixed(0)}%`
                        : "0%"}
                    </span>
                    <span className="text-[10px] text-rose-600 block">
                      {data.aiPerformance.feedbackCounts.rejected} cases
                    </span>
                  </div>
                </div>

                {/* Rubric Score Averages */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                    Human Review Rubric Averages (1-5 Scale)
                  </h4>
                  <div className="space-y-2 text-xs">
                    {[
                      {
                        name: "Relevance to Complaint",
                        score: data.aiPerformance.rubricScoreAverages.relevance,
                      },
                      {
                        name: "Evidence Grounding & Support",
                        score: data.aiPerformance.rubricScoreAverages.evidence,
                      },
                      {
                        name: "Citation Correctness",
                        score: data.aiPerformance.rubricScoreAverages.citation,
                      },
                      {
                        name: "Actionability & SOP Steps",
                        score: data.aiPerformance.rubricScoreAverages.actionability,
                      },
                      {
                        name: "Safety & Regulatory Compliance",
                        score: data.aiPerformance.rubricScoreAverages.safety,
                      },
                    ].map((item) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between"
                      >
                        <span className="text-slate-600">{item.name}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-slate-200 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-indigo-600 h-full rounded-full"
                              style={{
                                width: `${(item.score / 5.0) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="font-bold text-slate-900 text-xs w-8 text-right">
                            {item.score.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Fourth Row: Staff Agent Workload Table */}
          <Card className="p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  Staff Agent Active Workload Distribution
                </h3>
                <p className="text-xs text-slate-500">
                  Current active complaint assignments across authorized personnel
                </p>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase text-[10px]">
                    <th className="pb-2">Agent Name</th>
                    <th className="pb-2">Email</th>
                    <th className="pb-2">Role</th>
                    <th className="pb-2 text-right">Active Assigned Cases</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.operations.agentWorkload.map((ag) => (
                    <tr key={ag.userId} className="hover:bg-slate-50">
                      <td className="py-2.5 font-semibold text-slate-900">
                        {ag.name}
                      </td>
                      <td className="py-2.5 font-mono text-slate-500 text-[11px]">
                        {ag.email}
                      </td>
                      <td className="py-2.5">
                        <Badge
                          variant={
                            ag.role === "ADMIN"
                              ? "danger"
                              : ag.role === "MANAGER"
                              ? "warning"
                              : "info"
                          }
                        >
                          {ag.role}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-right font-black text-slate-800">
                        {ag.activeAssignments}
                      </td>
                    </tr>
                  ))}
                  {data.operations.agentWorkload.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-400">
                        No agent assignments recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
