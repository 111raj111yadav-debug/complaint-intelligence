import React, { useEffect, useState, useCallback } from "react";
import {
  Inbox,
  Plus,
  Search,
  RefreshCw,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  Send,
  X,
  Sparkles,
  UserCheck,
  History,
  Clock,
  Layers,
} from "lucide-react";
import { Card } from "../../components/ui/Card.js";
import { Badge } from "../../components/ui/Badge.js";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner.js";
import { ErrorMessage } from "../../components/ui/ErrorMessage.js";
import { EmptyState } from "../../components/ui/EmptyState.js";
import { RecommendationPanel } from "./components/RecommendationPanel.js";
import {
  fetchComplaints,
  fetchComplaintById,
  createComplaint,
  analyzeComplaint,
  updateComplaintStatus,
  assignComplaint,
} from "../../services/complaints-service.js";
import { fetchStaffUsers } from "../../services/auth-service.js";
import { apiClient } from "../../lib/api-client.js";
import { useAuth } from "../../lib/auth-context.js";
import {
  ComplaintItem,
  ComplaintAnalysisItem,
  PaginationMeta,
  AuthUser,
  Department,
} from "../../types/index.js";

const PRESET_TEMPLATES = [
  {
    title: "Double Charge on Card",
    text: "My credit card was charged twice for $249.99 on October 12th. I called three times with no response. Please reverse the duplicate fee immediately before tomorrow!",
    source: "WEB",
  },
  {
    title: "Inaccurate Credit Report",
    text: "An unknown delinquent collection account appeared on my credit report. I never opened this account and I am a victim of identity theft. Please remove this immediately pursuant to the Fair Credit Reporting Act.",
    source: "WEB",
  },
  {
    title: "Unlawful Debt Harassment",
    text: "Debt collectors are calling my workplace 10 times a day threatening legal action and wage garnishment for a debt that was already settled two years ago.",
    source: "MOBILE_APP",
  },
  {
    title: "Mortgage Escrow Error",
    text: "My mortgage servicer improperly calculated my annual property tax escrow and increased my monthly payment by $600 without prior written notice.",
    source: "WEB",
  },
];

export const ComplaintsPage: React.FC = () => {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("");

  // New Complaint Modal Form
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newText, setNewText] = useState<string>("");
  const [newSource, setNewSource] = useState<string>("WEB");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [createSuccessRef, setCreateSuccessRef] = useState<string | null>(null);
  const [createSuccessId, setCreateSuccessId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  // Detail Modal & Tabs
  const [selectedComplaint, setSelectedComplaint] =
    useState<ComplaintItem | null>(null);
  const [detailTab, setDetailTab] = useState<
    "ANALYSIS" | "WORKFLOW" | "AUDIT"
  >("ANALYSIS");
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Staff and Department state for assignment
  const [staffUsers, setStaffUsers] = useState<AuthUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Assignment Modal
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  const [assignDeptId, setAssignDeptId] = useState<string>("");
  const [assignUserId, setAssignUserId] = useState<string>("");
  const [assignPriority, setAssignPriority] = useState<string>("NORMAL");
  const [reassignReason, setReassignReason] = useState<string>("");
  const [assignSubmitting, setAssignSubmitting] = useState<boolean>(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Reopen Modal
  const [showReopenModal, setShowReopenModal] = useState<boolean>(false);
  const [reopenReason, setReopenReason] = useState<string>("");
  const [reopenSubmitting, setReopenSubmitting] = useState<boolean>(false);
  const [reopenError, setReopenError] = useState<string | null>(null);

  const loadComplaints = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchComplaints({
          page,
          limit: 10,
          status: statusFilter || undefined,
          urgency: urgencyFilter || undefined,
          search: searchQuery || undefined,
        });
        setComplaints(res.complaints);
        setPagination(res.pagination);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load complaints list.",
        );
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, urgencyFilter, searchQuery],
  );

  useEffect(() => {
    loadComplaints(1);
  }, [loadComplaints]);

  // Load staff and departments for assignments
  useEffect(() => {
    const loadStaffAndDepts = async () => {
      try {
        const users = await fetchStaffUsers();
        setStaffUsers(users);
      } catch (e) {
        // Ignore if unauthenticated
      }

      try {
        const res = await apiClient.get<{ success: boolean; data: Department[] }>(
          "/departments",
        );
        if (res.data.data) {
          setDepartments(res.data.data);
        }
      } catch (e) {
        // Fallback
      }
    };
    loadStaffAndDepts();
  }, []);

  const openComplaintDetail = async (c: ComplaintItem) => {
    setSelectedComplaint(c);
    setDetailTab("ANALYSIS");
    setLoadingDetail(true);
    try {
      const full = await fetchComplaintById(c.id);
      setSelectedComplaint(full);
    } catch (err) {
      // Keep existing data
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim() || newText.trim().length < 10) {
      setCreateError(
        "Complaint narrative must be at least 10 characters long.",
      );
      return;
    }
    setSubmitting(true);
    setCreateError(null);
    try {
      const created = await createComplaint({
        text: newText.trim(),
        source: newSource,
      });
      setCreateSuccessRef(created.referenceNumber);
      setCreateSuccessId(created.id);
      setNewText("");
      loadComplaints(1);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to submit complaint.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRunAnalysis = async (complaintId: string) => {
    setAnalyzingId(complaintId);
    setAnalysisError(null);
    try {
      await analyzeComplaint(complaintId);
      // Reload full complaint
      const refreshed = await fetchComplaintById(complaintId);
      setComplaints((prev) =>
        prev.map((c) => (c.id === complaintId ? refreshed : c)),
      );
      if (selectedComplaint && selectedComplaint.id === complaintId) {
        setSelectedComplaint(refreshed);
      }
    } catch (err) {
      setAnalysisError(
        err instanceof Error
          ? err.message
          : "NLP analysis request failed or Python microservice is offline.",
      );
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleStatusTransition = async (newStatus: string) => {
    if (!selectedComplaint) return;

    // If reopening from RESOLVED to IN_REVIEW, prompt for mandatory reason
    if (selectedComplaint.status === "RESOLVED" && newStatus === "IN_REVIEW") {
      setShowReopenModal(true);
      return;
    }

    try {
      await updateComplaintStatus(
        selectedComplaint.id,
        newStatus,
      );
      // Refresh detail
      const refreshed = await fetchComplaintById(selectedComplaint.id);
      setSelectedComplaint(refreshed);
      setComplaints((prev) =>
        prev.map((c) => (c.id === refreshed.id ? refreshed : c)),
      );
    } catch (err) {
      setAnalysisError(
        err instanceof Error ? err.message : "Failed to transition status.",
      );
    }
  };

  const handleReopenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    if (!reopenReason.trim() || reopenReason.trim().length < 5) {
      setReopenError("Please provide a valid documented reason for reopening.");
      return;
    }

    setReopenSubmitting(true);
    setReopenError(null);
    try {
      await updateComplaintStatus(
        selectedComplaint.id,
        "IN_REVIEW",
        reopenReason.trim(),
      );
      const refreshed = await fetchComplaintById(selectedComplaint.id);
      setSelectedComplaint(refreshed);
      setComplaints((prev) =>
        prev.map((c) => (c.id === refreshed.id ? refreshed : c)),
      );
      setShowReopenModal(false);
      setReopenReason("");
    } catch (err) {
      setReopenError(
        err instanceof Error ? err.message : "Failed to reopen complaint.",
      );
    } finally {
      setReopenSubmitting(false);
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    if (!assignDeptId) {
      setAssignError("Please select a target department.");
      return;
    }

    const currentAssign = selectedComplaint.assignments?.find((a) => a.isCurrent);
    if (currentAssign && !reassignReason.trim()) {
      setAssignError("A recorded reassignment reason is required when reassigning.");
      return;
    }

    setAssignSubmitting(true);
    setAssignError(null);
    try {
      await assignComplaint({
        complaintId: selectedComplaint.id,
        departmentId: assignDeptId,
        assignedToUserId: assignUserId || undefined,
        priority: assignPriority,
        reassignReason: reassignReason.trim() || undefined,
      });

      const refreshed = await fetchComplaintById(selectedComplaint.id);
      setSelectedComplaint(refreshed);
      setComplaints((prev) =>
        prev.map((c) => (c.id === refreshed.id ? refreshed : c)),
      );
      setShowAssignModal(false);
      setReassignReason("");
    } catch (err) {
      setAssignError(
        err instanceof Error ? err.message : "Failed to assign complaint.",
      );
    } finally {
      setAssignSubmitting(false);
    }
  };

  const getUrgencyBadgeVariant = (
    level?: string,
  ): "success" | "warning" | "info" | "neutral" | "danger" => {
    switch (level) {
      case "CRITICAL":
        return "danger";
      case "HIGH":
        return "warning";
      case "MEDIUM":
        return "info";
      default:
        return "neutral";
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "RESOLVED":
        return "success";
      case "IN_REVIEW":
        return "warning";
      case "ANALYZED":
        return "info";
      case "DISMISSED":
        return "neutral";
      default:
        return "neutral";
    }
  };

  const formatCategoryName = (raw?: string) => {
    if (!raw) return "Uncategorized";
    return raw
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  const formatSlaStatus = (item: ComplaintItem) => {
    if (item.status === "RESOLVED") {
      return (
        <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Resolved
        </span>
      );
    }
    if (item.isOverdue) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
          <AlertTriangle className="w-3 h-3" /> OVERDUE
        </span>
      );
    }
    if (item.slaDeadline) {
      const diffMs = new Date(item.slaDeadline).getTime() - Date.now();
      const diffHours = Math.round(diffMs / (1000 * 60 * 60));
      return (
        <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
          <Clock className="w-3 h-3 text-slate-400" />
          {diffHours > 0 ? `${diffHours}h left` : "Breaching"}
        </span>
      );
    }
    return <span className="text-[10px] text-slate-400">—</span>;
  };

  const isAuditor = user?.role === "AUDITOR";

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Inbox className="w-6 h-6 text-indigo-600" />
            Customer Complaints Queue
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time complaint triage powered by PostgreSQL, pgvector retrieval,
            SLA deadlines, and auditable RBAC operations.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadComplaints(pagination.page)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-600" : ""}`}
            />
            Refresh Queue
          </button>
          <button
            onClick={() => {
              setShowCreateModal(true);
              setCreateSuccessRef(null);
              setCreateSuccessId(null);
              setCreateError(null);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Submit Complaint
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-3 bg-white">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search complaint narratives or reference codes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50/50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder:text-slate-400"
            />
          </div>
          <div className="sm:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending Triage</option>
              <option value="ANALYZED">Analyzed</option>
              <option value="IN_REVIEW">In Review (Escalated)</option>
              <option value="RESOLVED">Resolved</option>
              <option value="DISMISSED">Dismissed</option>
            </select>
          </div>
          <div className="sm:col-span-3">
            <select
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="">All Urgency Levels</option>
              <option value="CRITICAL">Critical Urgency</option>
              <option value="HIGH">High Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="LOW">Low Priority</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Main Complaints Table Content */}
      {loading && complaints.length === 0 ? (
        <Card className="py-16">
          <LoadingSpinner
            size="lg"
            label="Loading complaints from PostgreSQL database..."
          />
        </Card>
      ) : error ? (
        <Card className="p-6">
          <ErrorMessage message={error} onRetry={() => loadComplaints(1)} />
        </Card>
      ) : complaints.length === 0 ? (
        <Card className="py-12">
          <EmptyState
            icon={Inbox}
            title="No Complaints Found"
            description={
              searchQuery || statusFilter || urgencyFilter
                ? "No complaints match the specified filter criteria. Try resetting filters."
                : "The complaint queue is currently empty. Submit your first customer complaint to run real NLP analysis."
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Complaint Preview</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Urgency</th>
                  <th className="py-3 px-4">SLA Target</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {complaints.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => openComplaintDetail(item)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-indigo-600 whitespace-nowrap">
                      {item.referenceNumber}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate font-medium text-slate-800">
                      {item.originalText}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {item.latestAnalysis ? (
                        <Badge variant="info">
                          {formatCategoryName(
                            item.latestAnalysis.predictedCategory,
                          )}
                        </Badge>
                      ) : (
                        <span className="text-slate-400 italic">
                          Not Analyzed
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {item.latestAnalysis ? (
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant={getUrgencyBadgeVariant(
                              item.latestAnalysis.urgencyLevel,
                            )}
                          >
                            {item.latestAnalysis.urgencyLevel}
                          </Badge>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {item.latestAnalysis.urgencyScore}/100
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {formatSlaStatus(item)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <Badge variant={getStatusBadgeVariant(item.status)}>
                        {item.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-400 text-[11px]">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td
                      className="py-3 px-4 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {!item.latestAnalysis ? (
                        <button
                          onClick={() => handleRunAnalysis(item.id)}
                          disabled={analyzingId === item.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 disabled:opacity-50"
                        >
                          <BrainCircuit
                            className={`w-3 h-3 ${analyzingId === item.id ? "animate-spin" : ""}`}
                          />
                          {analyzingId === item.id ? "Analyzing..." : "Analyze"}
                        </button>
                      ) : (
                        <button
                          onClick={() => openComplaintDetail(item)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-indigo-600"
                        >
                          View Details <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Showing {complaints.length} of {pagination.total} complaints
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1 || loading}
                onClick={() => loadComplaints(pagination.page - 1)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white font-medium hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="font-semibold text-slate-700">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => loadComplaints(pagination.page + 1)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white font-medium hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail & AI Intelligence Modal */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <BrainCircuit className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 font-mono">
                      {selectedComplaint.referenceNumber}
                    </h3>
                    <Badge
                      variant={getStatusBadgeVariant(selectedComplaint.status)}
                    >
                      {selectedComplaint.status}
                    </Badge>
                    {selectedComplaint.isOverdue && (
                      <Badge variant="danger">OVERDUE</Badge>
                    )}
                    {loadingDetail && (
                      <span className="text-[10px] text-slate-400 font-mono animate-pulse">
                        Syncing...
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Submitted via {selectedComplaint.source} on{" "}
                    {new Date(selectedComplaint.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedComplaint(null);
                    setAnalysisError(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Tab Navigation */}
            <div className="flex border-b border-slate-200 px-6 bg-slate-50/30 text-xs font-semibold text-slate-500">
              <button
                onClick={() => setDetailTab("ANALYSIS")}
                className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
                  detailTab === "ANALYSIS"
                    ? "border-indigo-600 text-indigo-700"
                    : "border-transparent hover:text-slate-800"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Analysis & Recommendations
              </button>
              <button
                onClick={() => setDetailTab("WORKFLOW")}
                className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
                  detailTab === "WORKFLOW"
                    ? "border-indigo-600 text-indigo-700"
                    : "border-transparent hover:text-slate-800"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Workflow & SLA
              </button>
              <button
                onClick={() => setDetailTab("AUDIT")}
                className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
                  detailTab === "AUDIT"
                    ? "border-indigo-600 text-indigo-700"
                    : "border-transparent hover:text-slate-800"
                }`}
              >
                <History className="w-3.5 h-3.5" />
                Audit Trail (
                {selectedComplaint.auditLogs?.length || 0})
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {analysisError && <ErrorMessage message={analysisError} />}

              {/* TAB 1: NLP ANALYSIS & RAG RECOMMENDATION */}
              {detailTab === "ANALYSIS" && (
                <>
                  {/* Original Complaint Narrative */}
                  <div>
                    <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      Original Complaint Narrative
                    </h4>
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 leading-relaxed font-sans whitespace-pre-wrap">
                      {selectedComplaint.originalText}
                    </div>
                  </div>

                  {/* NLP Intelligence Results */}
                  {selectedComplaint.latestAnalysis ||
                  (selectedComplaint.analyses &&
                    selectedComplaint.analyses.length > 0) ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[11px] font-semibold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                          NLP Complaint Intelligence Results
                        </h4>
                        <button
                          onClick={() => handleRunAnalysis(selectedComplaint.id)}
                          disabled={analyzingId === selectedComplaint.id}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                        >
                          <RefreshCw
                            className={`w-3 h-3 ${analyzingId === selectedComplaint.id ? "animate-spin" : ""}`}
                          />
                          Re-run AI Analysis
                        </button>
                      </div>

                      {(() => {
                        const analysis: ComplaintAnalysisItem | null =
                          selectedComplaint.latestAnalysis ||
                          (selectedComplaint.analyses &&
                            selectedComplaint.analyses[0]) ||
                          null;
                        if (!analysis) return null;

                        return (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {/* Category Card */}
                              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                  Predicted Category
                                </span>
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-bold text-slate-900">
                                    {formatCategoryName(
                                      analysis.predictedCategory,
                                    )}
                                  </span>
                                  <Badge variant="info">
                                    {Math.round(
                                      analysis.categoryConfidence * 100,
                                    )}
                                    % Confidence
                                  </Badge>
                                </div>
                              </div>

                              {/* Urgency Card */}
                              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                  Urgency Level
                                </span>
                                <div className="flex items-center justify-between">
                                  <Badge
                                    variant={getUrgencyBadgeVariant(
                                      analysis.urgencyLevel,
                                    )}
                                  >
                                    {analysis.urgencyLevel}
                                  </Badge>
                                  <span className="text-xs font-mono font-bold text-slate-700">
                                    Score: {analysis.urgencyScore} / 100
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Human Review Warning if flagged */}
                            {analysis.humanReviewRequired && (
                              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
                                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                <div className="space-y-1 text-xs">
                                  <span className="font-bold text-amber-900 block">
                                    Mandatory Human Review Triggered
                                  </span>
                                  <p className="text-amber-800 text-[11px]">
                                    This complaint contains critical urgency, legal
                                    threats, or regulatory agency mentions.
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center space-y-2">
                      <p className="text-xs text-slate-500">
                        This complaint has not been analyzed by the NLP service.
                      </p>
                      <button
                        onClick={() => handleRunAnalysis(selectedComplaint.id)}
                        disabled={analyzingId === selectedComplaint.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                      >
                        <BrainCircuit className="w-3.5 h-3.5" />
                        Run AI Analysis Now
                      </button>
                    </div>
                  )}

                  {/* Recommendation Panel */}
                  <div className="pt-2">
                    <RecommendationPanel
                      complaintId={selectedComplaint.id}
                      complaintText={selectedComplaint.originalText}
                      initialRecommendation={
                        selectedComplaint.recommendations &&
                        selectedComplaint.recommendations.length > 0
                          ? selectedComplaint.recommendations[0]
                          : null
                      }
                      onRecommendationUpdated={(rec) => {
                        setSelectedComplaint((prev) =>
                          prev
                            ? {
                                ...prev,
                                recommendations: [
                                  rec,
                                  ...(prev.recommendations || []).filter(
                                    (r) => r.id !== rec.id,
                                  ),
                                ],
                              }
                            : null,
                        );
                      }}
                    />
                  </div>
                </>
              )}

              {/* TAB 2: WORKFLOW STATE & ASSIGNMENT */}
              {detailTab === "WORKFLOW" && (
                <div className="space-y-6">
                  {/* SLA & Deadlines Card */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-indigo-600" />
                      SLA Timings & Deadlines
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">
                          SLA Deadline
                        </span>
                        <span className="font-semibold text-slate-800">
                          {selectedComplaint.slaDeadline
                            ? new Date(selectedComplaint.slaDeadline).toLocaleString()
                            : "Not Set"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">
                          First Assigned
                        </span>
                        <span className="font-semibold text-slate-800">
                          {selectedComplaint.firstAssignedAt
                            ? new Date(selectedComplaint.firstAssignedAt).toLocaleString()
                            : "Pending Assignment"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">
                          Resolved At
                        </span>
                        <span className="font-semibold text-slate-800">
                          {selectedComplaint.resolvedAt
                            ? new Date(selectedComplaint.resolvedAt).toLocaleString()
                            : "Unresolved"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">
                          Overdue Status
                        </span>
                        {selectedComplaint.isOverdue ? (
                          <span className="font-bold text-rose-600">
                            BREACHED
                          </span>
                        ) : (
                          <span className="font-medium text-emerald-600">
                            Within SLA
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Active Assignment Card */}
                  <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-indigo-600" />
                        Current Assignment
                      </h4>
                      {!isAuditor && (
                        <button
                          onClick={() => {
                            const current = selectedComplaint.assignments?.find(
                              (a) => a.isCurrent,
                            );
                            if (current) {
                              setAssignDeptId(current.departmentId);
                              setAssignUserId(current.assignedToUserId || "");
                              setAssignPriority(current.priority || "NORMAL");
                            }
                            setShowAssignModal(true);
                          }}
                          className="px-3 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
                        >
                          {selectedComplaint.assignments?.some((a) => a.isCurrent)
                            ? "Reassign Complaint"
                            : "Assign Complaint"}
                        </button>
                      )}
                    </div>

                    {(() => {
                      const current = selectedComplaint.assignments?.find(
                        (a) => a.isCurrent,
                      );
                      if (!current) {
                        return (
                          <p className="text-xs text-slate-400 italic">
                            This complaint has not been assigned to a department or staff member.
                          </p>
                        );
                      }

                      return (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase">
                              Department
                            </span>
                            <span className="font-semibold text-slate-900">
                              {current.department?.name || current.departmentId}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase">
                              Assigned Agent
                            </span>
                            <span className="font-semibold text-slate-900">
                              {current.assignedTo?.name || "Unassigned Agent"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase">
                              Priority
                            </span>
                            <Badge variant={current.priority === "CRITICAL" ? "danger" : "info"}>
                              {current.priority}
                            </Badge>
                          </div>
                          {current.reassignReason && (
                            <div className="col-span-full p-2.5 bg-amber-50 rounded-lg text-amber-900 text-xs">
                              <strong>Reassignment Justification:</strong>{" "}
                              {current.reassignReason}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Status Lifecycle Transition Controls */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Workflow Lifecycle Transitions
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Permitted transitions follow state machine: PENDING → ANALYZED → IN_REVIEW → RESOLVED. Reopening a resolved case requires documented justification.
                    </p>

                    {isAuditor ? (
                      <p className="text-xs text-slate-400 italic">
                        Read-only auditor mode: Status cannot be altered.
                      </p>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        {selectedComplaint.status === "PENDING" && (
                          <button
                            onClick={() => handleStatusTransition("IN_REVIEW")}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                          >
                            Mark In Review
                          </button>
                        )}

                        {selectedComplaint.status === "ANALYZED" && (
                          <button
                            onClick={() => handleStatusTransition("IN_REVIEW")}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                          >
                            Send to In Review
                          </button>
                        )}

                        {selectedComplaint.status === "IN_REVIEW" && (
                          <>
                            <button
                              onClick={() => {
                                if (
                                  confirm(
                                    "Confirm that all dispute steps have been executed and customer notified. Mark as RESOLVED?",
                                  )
                                ) {
                                  handleStatusTransition("RESOLVED");
                                }
                              }}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Confirm Resolved
                            </button>
                            <button
                              onClick={() => {
                                if (
                                  confirm(
                                    "Are you sure you want to dismiss this complaint as ungrounded or duplicate?",
                                  )
                                ) {
                                  handleStatusTransition("DISMISSED");
                                }
                              }}
                              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg"
                            >
                              Dismiss Complaint
                            </button>
                          </>
                        )}

                        {selectedComplaint.status === "RESOLVED" && (
                          <button
                            onClick={() => setShowReopenModal(true)}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                          >
                            Reopen Complaint (Requires Justification)
                          </button>
                        )}

                        {selectedComplaint.status === "DISMISSED" && (
                          <button
                            onClick={() => handleStatusTransition("IN_REVIEW")}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg"
                          >
                            Restore to In Review
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: CHRONOLOGICAL AUDIT LOG TRAIL */}
              {detailTab === "AUDIT" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <History className="w-4 h-4 text-indigo-600" />
                      Complete Chronological Audit Trail
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      Immutable action history
                    </span>
                  </div>

                  {(!selectedComplaint.auditLogs ||
                    selectedComplaint.auditLogs.length === 0) ? (
                    <p className="text-xs text-slate-400 italic py-6 text-center">
                      No audit events recorded for this complaint yet.
                    </p>
                  ) : (
                    <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                      {selectedComplaint.auditLogs.map((log) => (
                        <div
                          key={log.id}
                          className="pl-8 relative flex items-start justify-between text-xs"
                        >
                          <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 absolute left-2 top-1.5 ring-4 ring-white" />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">
                                {log.action.replace(/_/g, " ")}
                              </span>
                              {log.toStatus && (
                                <Badge variant="neutral">
                                  {log.fromStatus || "START"} → {log.toStatus}
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              By:{" "}
                              <span className="font-semibold text-slate-700">
                                {log.actor?.name || "System"}
                              </span>{" "}
                              {log.actor?.role && (
                                <span className="font-mono text-[10px] text-indigo-600">
                                  ({log.actor.role})
                                </span>
                              )}
                            </div>
                            {log.reason && (
                              <p className="p-2 bg-slate-50 rounded border border-slate-200 text-slate-700 text-[11px]">
                                <strong>Reason:</strong> {log.reason}
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50">
              <button
                onClick={() => setSelectedComplaint(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assignment / Reassignment Modal */}
      {showAssignModal && selectedComplaint && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-600" />
                Assign Complaint
              </h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="p-5 space-y-4 text-xs">
              {assignError && <ErrorMessage message={assignError} />}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Target Department <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={assignDeptId}
                  onChange={(e) => setAssignDeptId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">Select Department...</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Assign to Specific Staff (Optional)
                </label>
                <select
                  value={assignUserId}
                  onChange={(e) => setAssignUserId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">Unassigned Pool</option>
                  {staffUsers
                    .filter((u) => u.role === "AGENT" || u.role === "MANAGER")
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role}) — {u.email}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Priority
                </label>
                <select
                  value={assignPriority}
                  onChange={(e) => setAssignPriority(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High Priority</option>
                  <option value="CRITICAL">Critical Urgency</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Reassignment Reason / Triage Notes
                </label>
                <textarea
                  rows={2}
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="Mandatory if reassigning from another department or agent..."
                  className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignSubmitting}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-xs"
                >
                  {assignSubmitting ? "Assigning..." : "Confirm Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reopen Reason Mandatory Modal */}
      {showReopenModal && selectedComplaint && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-amber-50">
              <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Reopen Complaint Justification
              </h3>
              <button
                onClick={() => setShowReopenModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReopenSubmit} className="p-5 space-y-4 text-xs">
              {reopenError && <ErrorMessage message={reopenError} />}

              <p className="text-slate-600">
                You are reopening resolved complaint{" "}
                <span className="font-mono font-bold text-slate-900">
                  {selectedComplaint.referenceNumber}
                </span>
                . In compliance with governance policies, specify the reason for reopening (e.g. customer dissatisfied with provisional credit, recurring transaction dispute):
              </p>

              <div>
                <textarea
                  required
                  rows={3}
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Document why this resolution is being reopened..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReopenModal(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reopenSubmitting}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-xs"
                >
                  {reopenSubmitting ? "Reopening..." : "Reopen Case"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Complaint Modal Form */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Log Customer Complaint
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Input customer grievance narrative for database persistence
                    and AI classification.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {createSuccessRef ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    Complaint Successfully Persisted in PostgreSQL
                  </div>
                  <p className="text-xs text-emerald-700">
                    Assigned Reference ID:{" "}
                    <span className="font-mono font-bold bg-emerald-100 px-2 py-0.5 rounded text-emerald-900">
                      {createSuccessRef}
                    </span>
                  </p>
                  <div className="flex items-center gap-2 pt-2">
                    {createSuccessId && (
                      <button
                        onClick={() => {
                          const id = createSuccessId;
                          setShowCreateModal(false);
                          handleRunAnalysis(id);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-xs"
                      >
                        <BrainCircuit className="w-3.5 h-3.5" />
                        Run AI Intelligence Analysis Now
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setCreateSuccessRef(null);
                        setCreateSuccessId(null);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800"
                    >
                      Submit Another
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCreateSubmit} className="space-y-4">
                  {createError && <ErrorMessage message={createError} />}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Quick Fill Sample Complaint:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {PRESET_TEMPLATES.map((tmpl, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setNewText(tmpl.text);
                            setNewSource(tmpl.source);
                          }}
                          className="text-left p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-indigo-50/50 hover:border-indigo-200 text-xs transition-colors"
                        >
                          <span className="font-semibold text-slate-800 block text-[11px]">
                            {tmpl.title}
                          </span>
                          <span className="text-[10px] text-slate-500 line-clamp-1">
                            {tmpl.text}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Complaint Narrative{" "}
                        <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[10px] text-slate-400">
                        {newText.length} / 10,000 characters
                      </span>
                    </div>
                    <textarea
                      rows={5}
                      required
                      value={newText}
                      onChange={(e) => setNewText(e.target.value)}
                      placeholder="Describe the complaint in detail (charges, transactions, errors, timeline)..."
                      className="w-full p-3 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder:text-slate-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Submission Channel
                      </label>
                      <select
                        value={newSource}
                        onChange={(e) => setNewSource(e.target.value)}
                        className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        <option value="WEB">Web Portal</option>
                        <option value="MOBILE_APP">Mobile Application</option>
                        <option value="BRANCH">Bank Branch In-Person</option>
                        <option value="PHONE">Customer Service Phone</option>
                        <option value="REGULATOR_CFPB">CFPB Portal Referral</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {submitting ? "Submitting..." : "Persist Complaint"}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
