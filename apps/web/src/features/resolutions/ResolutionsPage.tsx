import React, { useEffect, useState } from "react";
import { Inbox } from "lucide-react";
import { Card } from "../../components/ui/Card.js";
import { Badge } from "../../components/ui/Badge.js";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner.js";
import { ErrorMessage } from "../../components/ui/ErrorMessage.js";
import { EmptyState } from "../../components/ui/EmptyState.js";
import { RecommendationPanel } from "../complaints/components/RecommendationPanel.js";
import { fetchComplaints } from "../../services/complaints-service.js";
import { ComplaintItem } from "../../types/index.js";

export const ResolutionsPage: React.FC = () => {
  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
  const [selectedComplaintId, setSelectedComplaintId] = useState<string>("");
  const [loadingComplaints, setLoadingComplaints] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoadingComplaints(true);
      setError(null);
      try {
        const res = await fetchComplaints({ page: 1, limit: 20 });
        setComplaints(res.complaints);
        if (res.complaints.length > 0) {
          setSelectedComplaintId(res.complaints[0].id);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load complaints for resolution studio.",
        );
      } finally {
        setLoadingComplaints(false);
      }
    }
    load();
  }, []);

  const selectedComplaint = complaints.find(
    (c) => c.id === selectedComplaintId,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-slate-900">
            RAG Resolution Recommendation Studio
          </h2>
          <Badge variant="info">pgvector & RAG Engine</Badge>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Evidence-grounded action steps synthesized from verified CFPB dispute
          precedents with calibrated evidence strength and regulatory oversight.
        </p>
      </div>

      {error && <ErrorMessage message={error} />}

      {loadingComplaints ? (
        <div className="py-16 flex flex-col items-center justify-center space-y-3">
          <LoadingSpinner size="lg" />
          <p className="text-xs text-slate-500 font-medium">
            Loading active dispute cases...
          </p>
        </div>
      ) : complaints.length === 0 ? (
        <Card>
          <EmptyState
            icon={Inbox}
            title="No Active Complaints Found"
            description="Submit customer complaints in the Complaints module to generate RAG resolutions."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Complaint Selector */}
          <div className="lg:col-span-1 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Select Dispute Case ({complaints.length})
            </h3>

            <div className="space-y-2 max-h-[75vh] overflow-y-auto pr-1">
              {complaints.map((c) => {
                const isSelected = c.id === selectedComplaintId;
                const latestAnalysis =
                  c.latestAnalysis || (c.analyses && c.analyses[0]);
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedComplaintId(c.id)}
                    className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all space-y-2 ${
                      isSelected
                        ? "bg-indigo-50/70 border-indigo-500 shadow-sm ring-1 ring-indigo-500/20"
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-[11px] text-slate-900">
                        {c.referenceNumber}
                      </span>
                      <Badge
                        variant={
                          c.status === "RESOLVED"
                            ? "success"
                            : c.status === "ANALYZED"
                              ? "info"
                              : "neutral"
                        }
                      >
                        {c.status}
                      </Badge>
                    </div>

                    <p className="text-slate-600 line-clamp-2 leading-relaxed">
                      {c.originalText}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                      <span>{c.source}</span>
                      {latestAnalysis && (
                        <span className="font-medium text-indigo-600">
                          {latestAnalysis.urgencyLevel} Urgency
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Case Details & RAG Recommendation Panel */}
          <div className="lg:col-span-2 space-y-5">
            {selectedComplaint ? (
              <div className="space-y-4">
                {/* Complaint Summary Card */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                        {selectedComplaint.referenceNumber}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 mt-1">
                        Active Dispute Narrative
                      </h4>
                    </div>
                    <Badge variant="neutral">
                      Submitted:{" "}
                      {new Date(
                        selectedComplaint.createdAt,
                      ).toLocaleDateString()}
                    </Badge>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 leading-relaxed font-sans">
                    {selectedComplaint.originalText}
                  </div>
                </div>

                {/* Grounded Recommendation Panel */}
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
                    setComplaints((prev) =>
                      prev.map((item) =>
                        item.id === selectedComplaint.id
                          ? {
                              ...item,
                              recommendations: [
                                rec,
                                ...(item.recommendations || []).filter(
                                  (r) => r.id !== rec.id,
                                ),
                              ],
                            }
                          : item,
                      ),
                    );
                  }}
                />
              </div>
            ) : (
              <Card>
                <EmptyState
                  icon={Inbox}
                  title="No Dispute Selected"
                  description="Choose a case from the list on the left to view or generate resolution recommendations."
                />
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
