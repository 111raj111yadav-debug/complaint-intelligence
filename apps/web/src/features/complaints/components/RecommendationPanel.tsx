import React, { useState } from "react";
import {
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  Edit3,
  Star,
  CheckCircle2,
  FileText,
  AlertTriangle,
  RotateCw,
} from "lucide-react";
import { Badge } from "../../../components/ui/Badge.js";
import { LoadingSpinner } from "../../../components/ui/LoadingSpinner.js";
import {
  ResolutionRecommendationItem,
  EvidenceStrength,
} from "../../../types/index.js";
import {
  generateRecommendation,
  submitRecommendationFeedback,
} from "../../../services/resolutions-service.js";

interface RecommendationPanelProps {
  complaintId: string;
  complaintText: string;
  initialRecommendation?: ResolutionRecommendationItem | null;
  onRecommendationUpdated?: (rec: ResolutionRecommendationItem) => void;
}

export const RecommendationPanel: React.FC<RecommendationPanelProps> = ({
  complaintId,
  initialRecommendation = null,
  onRecommendationUpdated,
}) => {
  const [recommendation, setRecommendation] =
    useState<ResolutionRecommendationItem | null>(initialRecommendation);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Expanded sources state
  const [expandedSources, setExpandedSources] = useState<
    Record<string, boolean>
  >({});

  // Checklist state for suggested action steps
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({});

  // Feedback form state
  const [decision, setDecision] = useState<"ACCEPTED" | "MODIFIED" | "REJECTED">("ACCEPTED");
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackNotes, setFeedbackNotes] = useState<string>("");
  const [agentModifications, setAgentModifications] = useState<string>("");
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [submittingFeedback, setSubmittingFeedback] = useState<boolean>(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<boolean>(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const feedbackAccepted = decision === "ACCEPTED";
  const setFeedbackAccepted = (val: boolean) => setDecision(val ? "ACCEPTED" : "MODIFIED");

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const rec = await generateRecommendation(complaintId);
      setRecommendation(rec);
      setCheckedSteps({});
      if (onRecommendationUpdated) {
        onRecommendationUpdated(rec);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate resolution recommendation.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSource = (sourceId: string) => {
    setExpandedSources((prev) => ({
      ...prev,
      [sourceId]: !prev[sourceId],
    }));
  };

  const handleToggleStep = (index: number) => {
    setCheckedSteps((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recommendation) return;

    setSubmittingFeedback(true);
    setFeedbackError(null);
    try {
      await submitRecommendationFeedback(complaintId, {
        wasAccepted: decision === "ACCEPTED",
        feedbackDecision: decision,
        rejectionReason: decision === "REJECTED" ? rejectionReason.trim() : undefined,
        agentRating: feedbackRating,
        feedbackNotes: feedbackNotes.trim() || undefined,
        agentModifications: decision === "MODIFIED"
          ? agentModifications.trim()
          : undefined,
        submittedBy: "DISPUTE_OFFICER",
      });
      setFeedbackSuccess(true);
      setTimeout(() => setFeedbackSuccess(false), 4000);
    } catch (err) {
      setFeedbackError(
        err instanceof Error
          ? err.message
          : "Failed to record recommendation feedback.",
      );
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const getEvidenceStrengthBadge = (strength: EvidenceStrength) => {
    switch (strength) {
      case "HIGH":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            HIGH EVIDENCE STRENGTH
          </span>
        );
      case "MEDIUM":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-300">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
            MEDIUM EVIDENCE STRENGTH
          </span>
        );
      case "LOW":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            LOW EVIDENCE STRENGTH
          </span>
        );
      case "INSUFFICIENT":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            INSUFFICIENT EVIDENCE
          </span>
        );
    }
  };

  if (!recommendation && !loading) {
    return (
      <div className="bg-gradient-to-br from-indigo-50/50 via-white to-slate-50 border border-indigo-100 rounded-xl p-6 text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
          <Sparkles className="w-6 h-6" />
        </div>
        <div className="max-w-md mx-auto space-y-1">
          <h4 className="text-sm font-semibold text-slate-900">
            AI-Assisted Resolution Recommendation
          </h4>
          <p className="text-xs text-slate-500">
            Retrieve top matching CFPB dispute playbooks from pgvector and
            generate an evidence-grounded resolution plan.
          </p>
        </div>
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 text-left">
            {error}
          </div>
        )}
        <button
          onClick={handleGenerate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
        >
          <Sparkles className="w-4 h-4" />
          Generate RAG Recommendation
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center space-y-3">
        <LoadingSpinner size="lg" />
        <p className="text-xs font-medium text-slate-600">
          Querying pgvector and generating grounded resolution steps...
        </p>
      </div>
    );
  }

  if (!recommendation) return null;

  return (
    <div className="space-y-5 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      {/* Header with Strength and Re-generate */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              RAG Resolution Recommendation
            </h4>
            <p className="text-xs text-slate-500">
              Provider: {recommendation.modelProvider} (
              {recommendation.modelIdentifier})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {getEvidenceStrengthBadge(recommendation.evidenceStrength)}
          <button
            onClick={handleGenerate}
            disabled={loading}
            title="Re-run recommendation generation"
            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-slate-200"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Human Review Banner if required */}
      {recommendation.humanReviewRequired && (
        <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-bold text-amber-900">
              Human Review & Oversight Mandated
            </p>
            <ul className="text-xs text-amber-800 list-disc list-inside space-y-0.5">
              {recommendation.reviewReasons.map((reason, idx) => (
                <li key={idx}>{reason}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Suggested Action Steps Checklist */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Suggested Action Steps ({recommendation.suggestedSteps.length})
          </h5>
          <span className="text-[11px] text-slate-400">
            Click step to mark completed
          </span>
        </div>
        <div className="space-y-2">
          {recommendation.suggestedSteps.map((step, idx) => {
            const isChecked = !!checkedSteps[idx];
            return (
              <div
                key={idx}
                onClick={() => handleToggleStep(idx)}
                className={`p-3 rounded-lg border text-xs cursor-pointer transition-all flex items-start gap-3 ${
                  isChecked
                    ? "bg-emerald-50/60 border-emerald-200 text-emerald-950 line-through opacity-80"
                    : "bg-slate-50/80 border-slate-200 hover:border-indigo-300 text-slate-800"
                }`}
              >
                <div
                  className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    isChecked
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  {isChecked && <CheckCircle2 className="w-3 h-3" />}
                </div>
                <div className="flex-1 leading-relaxed">
                  <span className="font-semibold mr-1.5">{idx + 1}.</span>
                  {step}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grounded Rationale */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-indigo-500" />
          Resolution Rationale & Regulatory Basis
        </h5>
        <p className="text-xs text-slate-700 leading-relaxed">
          {recommendation.rationale}
        </p>
      </div>

      {/* Supporting Evidence Sources */}
      {recommendation.sources && recommendation.sources.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Retrieved Evidence Sources ({recommendation.sources.length})
          </h5>
          <div className="space-y-2">
            {recommendation.sources.map((source) => {
              const isExpanded = !!expandedSources[source.id];
              return (
                <div
                  key={source.id}
                  className="border border-slate-200 rounded-lg bg-white overflow-hidden text-xs"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleSource(source.id)}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[11px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                        {source.resolution?.referenceCode || "KB-PLAYBOOK"}
                      </span>
                      <span className="font-semibold text-slate-800">
                        {source.resolution?.title || "Historical Resolution"}
                      </span>
                      <Badge variant="info">
                        {(source.similarityScore * 100).toFixed(1)}% match
                      </Badge>
                      {source.resolution?.resolutionOutcome && (
                        <Badge variant="success">
                          {source.resolution.resolutionOutcome}
                        </Badge>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </button>

                  {isExpanded && source.resolution && (
                    <div className="p-3.5 bg-slate-50 border-t border-slate-100 space-y-2.5 text-xs text-slate-600">
                      <div>
                        <span className="font-semibold text-slate-700">
                          Dispute Pattern:
                        </span>
                        <p className="mt-0.5 text-slate-600 italic">
                          "{source.resolution.complaintText}"
                        </p>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-700">
                          Playbook Resolution:
                        </span>
                        <p className="mt-0.5 text-slate-600">
                          {source.resolution.resolutionText}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recommendation Feedback Section */}
      <div className="pt-4 border-t border-slate-100">
        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
          Officer Resolution Feedback
        </h5>

        {feedbackSuccess && (
          <div className="mb-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Feedback recorded successfully.
          </div>
        )}

        {feedbackError && (
          <div className="mb-3 p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700">
            {feedbackError}
          </div>
        )}

        <form onSubmit={handleSubmitFeedback} className="space-y-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFeedbackAccepted(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all ${
                  feedbackAccepted
                    ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <ThumbsUp className="w-3.5 h-3.5" />
                Accept As-Is
              </button>
              <button
                type="button"
                onClick={() => setFeedbackAccepted(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all ${
                  decision === "MODIFIED"
                    ? "bg-amber-600 border-amber-600 text-white shadow-sm"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                Modify / Override
              </button>
              <button
                type="button"
                onClick={() => setDecision("REJECTED")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all ${
                  decision === "REJECTED"
                    ? "bg-rose-600 border-rose-600 text-white shadow-sm"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Reject Recommendation
              </button>
            </div>

            {/* Rating Stars */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500 mr-1">Quality:</span>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setFeedbackRating(star)}
                  className="p-0.5 text-amber-400 hover:text-amber-500 transition-colors"
                >
                  <Star
                    className={`w-4 h-4 ${
                      star <= feedbackRating
                        ? "fill-amber-400"
                        : "text-slate-300"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {decision === "MODIFIED" && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Modified Action Steps or Custom Disciplinary Instructions
              </label>
              <textarea
                value={agentModifications}
                onChange={(e) => setAgentModifications(e.target.value)}
                placeholder="Explain what steps you altered or added..."
                rows={2}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          )}

          {decision === "REJECTED" && (
            <div>
              <label className="block text-xs font-medium text-rose-700 mb-1">
                Reason for Rejecting Recommendation
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Specify why this recommendation is unacceptable (e.g. incorrect law, wrong category, unsupported steps)..."
                rows={2}
                className="w-full text-xs p-2.5 border border-rose-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
          )}

          <div className="flex items-center gap-3">
            <input
              type="text"
              value={feedbackNotes}
              onChange={(e) => setFeedbackNotes(e.target.value)}
              placeholder="Officer notes or compliance comments (optional)..."
              className="flex-1 text-xs px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={submittingFeedback}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {submittingFeedback ? "Saving..." : "Submit Feedback"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
