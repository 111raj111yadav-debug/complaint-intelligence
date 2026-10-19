import React, { useState } from "react";
import {
  BrainCircuit,
  Sparkles,
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Smile,
  Frown,
  Meh,
  Building2,
  FileText,
} from "lucide-react";
import { Card } from "../../components/ui/Card.js";
import { Badge } from "../../components/ui/Badge.js";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner.js";
import { ErrorMessage } from "../../components/ui/ErrorMessage.js";
import { submitAndAnalyzeComplaint } from "../../services/complaints-service.js";
import { ComplaintItem, ComplaintAnalysisItem } from "../../types/index.js";
import { Link } from "react-router-dom";

const BENCHMARK_SAMPLES = [
  {
    category: "Credit Reporting",
    title: "Inaccurate Inquiries on Credit Bureau",
    text: "I am writing to have inaccurate inquiries and accounts removed from my credit file. I am a victim of identity theft and never authorized these hard inquiries. Please delete these immediately pursuant to Section 605B of the Fair Credit Reporting Act.",
  },
  {
    category: "Debt Collection",
    title: "Unlawful Harassment & Repeated Threats",
    text: "Collection agents have called me multiple times at work threatening to seize my car and freeze my paycheck. I have repeatedly told them this debt is not mine and asked for debt validation but received no response.",
  },
  {
    category: "Credit Card",
    title: "Double Charge & Stolen Card",
    text: "My credit card was deducted twice for $480.00 while traveling. I am stranded without money and my card has been locked. Please reverse the duplicate fee immediately before tomorrow!",
  },
  {
    category: "Mortgages & Loans",
    title: "Escrow Shortage & Foreclosure Threat",
    text: "My mortgage servicer improperly reported my escrow account as deficient and sent an erroneous foreclosure warning. I made all payments on time and have proof from my bank statements.",
  },
  {
    category: "Retail Banking",
    title: "Unauthorized Account Lockout & Funds Frozen",
    text: "My checking account was frozen with my entire paycheck inside. I cannot access funds to buy groceries or pay my rent due today. Nobody responds at customer service.",
  },
];

export const AnalysisPage: React.FC = () => {
  const [inputText, setInputText] = useState<string>(BENCHMARK_SAMPLES[2].text);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    complaint: ComplaintItem;
    analysis: ComplaintAnalysisItem;
  } | null>(null);

  const handleAnalyze = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || inputText.trim().length < 10) {
      setError("Please enter a complaint narrative of at least 10 characters.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await submitAndAnalyzeComplaint(
        inputText.trim(),
        "AI_SANDBOX",
      );
      setResult(res);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to communicate with NLP microservice.",
      );
    } finally {
      setLoading(false);
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

  const formatCategoryName = (raw?: string) => {
    if (!raw) return "Uncategorized";
    return raw
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <BrainCircuit className="w-6 h-6 text-indigo-600" />
          Interactive NLP Complaint Intelligence Sandbox
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Test real NLP model inference live: TF-IDF category classification,
          VADER sentiment, Plutchik emotion detection, explainable urgency
          scoring, and department recommendation.
        </p>
      </div>

      {/* Preset Sample Prompts */}
      <div>
        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Select Benchmark Complaint to Test:
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {BENCHMARK_SAMPLES.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setInputText(sample.text);
                setResult(null);
                setError(null);
              }}
              className="text-left p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-indigo-50/60 hover:border-indigo-300 transition-all shadow-sm group"
            >
              <span className="text-[10px] font-bold text-indigo-600 block uppercase tracking-wider">
                {sample.category}
              </span>
              <span className="text-xs font-semibold text-slate-800 line-clamp-1 group-hover:text-indigo-950 mt-0.5">
                {sample.title}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Input Form Card */}
      <Card className="p-5">
        <form onSubmit={handleAnalyze} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-600" />
                Customer Complaint Narrative Input
              </label>
              <span className="text-[10px] text-slate-400 font-mono">
                {inputText.length} characters |{" "}
                {inputText.split(/\s+/).filter(Boolean).length} words
              </span>
            </div>
            <textarea
              rows={4}
              required
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste or type any customer complaint text..."
              className="w-full p-3.5 text-xs text-slate-800 bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder:text-slate-400 leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-500">
              Inference is executed via live FastAPI backend and persisted in
              PostgreSQL.
            </span>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 rounded-xl shadow-md hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" />
                  Running Inference...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Run Live AI Analysis
                </>
              )}
            </button>
          </div>
        </form>
      </Card>

      {error && <ErrorMessage message={error} />}

      {/* Analysis Results Display */}
      {result && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">
                Analysis Results for
              </span>
              <span className="font-mono text-xs font-bold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-lg border border-indigo-200">
                {result.complaint.referenceNumber}
              </span>
            </div>
            <Link
              to="/complaints"
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              View in Complaints Queue <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* 4 Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Category Card */}
            <Card className="p-4 bg-white border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Category
                </span>
                <Badge variant="info">
                  {Math.round(result.analysis.categoryConfidence * 100)}% Conf
                </Badge>
              </div>
              <div className="text-base font-extrabold text-slate-900">
                {formatCategoryName(result.analysis.predictedCategory)}
              </div>
              {result.analysis.categoryProbabilities && (
                <div className="space-y-1 pt-1 border-t border-slate-100">
                  <span className="text-[9px] font-semibold text-slate-400 uppercase">
                    Class Probability Distribution:
                  </span>
                  {Object.entries(result.analysis.categoryProbabilities).map(
                    ([cls, prob]) => (
                      <div
                        key={cls}
                        className="flex items-center justify-between text-[10px]"
                      >
                        <span className="text-slate-600 truncate max-w-[120px]">
                          {formatCategoryName(cls)}
                        </span>
                        <span className="font-mono font-medium text-slate-500">
                          {Math.round(prob * 100)}%
                        </span>
                      </div>
                    ),
                  )}
                </div>
              )}
            </Card>

            {/* Urgency Card */}
            <Card className="p-4 bg-white border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Urgency Score
                </span>
                <Badge
                  variant={getUrgencyBadgeVariant(result.analysis.urgencyLevel)}
                >
                  {result.analysis.urgencyLevel}
                </Badge>
              </div>
              <div className="text-base font-extrabold text-slate-900 font-mono">
                {result.analysis.urgencyScore} / 100
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    result.analysis.urgencyLevel === "CRITICAL"
                      ? "bg-rose-500"
                      : result.analysis.urgencyLevel === "HIGH"
                        ? "bg-amber-500"
                        : result.analysis.urgencyLevel === "MEDIUM"
                          ? "bg-sky-500"
                          : "bg-emerald-500"
                  }`}
                  style={{ width: `${result.analysis.urgencyScore}%` }}
                />
              </div>
              {result.analysis.humanReviewRequired && (
                <div className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 p-1 rounded">
                  <ShieldAlert className="w-3 h-3 text-amber-600" />
                  Eligible for Immediate Human Review
                </div>
              )}
            </Card>

            {/* Sentiment Card */}
            <Card className="p-4 bg-white border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Sentiment
                </span>
                <Badge
                  variant={
                    result.analysis.sentimentLabel === "positive"
                      ? "success"
                      : result.analysis.sentimentLabel === "negative"
                        ? "danger"
                        : "neutral"
                  }
                >
                  {result.analysis.sentimentLabel.toUpperCase()}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {result.analysis.sentimentLabel === "positive" ? (
                  <Smile className="w-5 h-5 text-emerald-600" />
                ) : result.analysis.sentimentLabel === "negative" ? (
                  <Frown className="w-5 h-5 text-rose-600" />
                ) : (
                  <Meh className="w-5 h-5 text-slate-500" />
                )}
                <span className="text-sm font-extrabold capitalize text-slate-900">
                  {result.analysis.sentimentLabel} Valence
                </span>
              </div>
              {result.analysis.sentimentCompound !== undefined && (
                <div className="text-[11px] text-slate-500 font-mono pt-1">
                  Polarity Index: {result.analysis.sentimentCompound}
                </div>
              )}
            </Card>

            {/* Emotion Card */}
            <Card className="p-4 bg-white border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Dominant Emotion
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  {Math.round((result.analysis.emotionConfidence || 0) * 100)}%
                </span>
              </div>
              <div className="text-base font-extrabold capitalize text-slate-900 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                {result.analysis.emotionPrimary}
              </div>
              {result.analysis.emotionScores && (
                <div className="space-y-1 pt-1 border-t border-slate-100">
                  <span className="text-[9px] font-semibold text-slate-400 uppercase">
                    Emotion Probability Signals:
                  </span>
                  {Object.entries(result.analysis.emotionScores)
                    .slice(0, 4)
                    .map(([emo, score]) => (
                      <div
                        key={emo}
                        className="flex items-center justify-between text-[10px]"
                      >
                        <span className="capitalize text-slate-600">{emo}</span>
                        <span className="font-mono text-slate-500">
                          {Math.round(score * 100)}%
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </Card>
          </div>

          {/* Department Recommendation & Urgency Explanation Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Department Routing */}
            <Card className="p-4 bg-indigo-50/40 border border-indigo-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  Recommended Operational Department
                </span>
                <Badge variant="neutral">
                  {result.analysis.departmentCode}
                </Badge>
              </div>
              <div className="text-sm font-extrabold text-indigo-950">
                {result.analysis.recommendedDepartment?.name ||
                  result.analysis.departmentCode}
              </div>
              {result.analysis.recommendedDepartment?.description && (
                <p className="text-xs text-indigo-900/80">
                  {result.analysis.recommendedDepartment.description}
                </p>
              )}
            </Card>

            {/* Urgency Explanation Details */}
            <Card className="p-4 bg-amber-50/40 border border-amber-200 space-y-2">
              <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Explainable Urgency Factors Triggered
              </span>
              {result.analysis.urgencyReasons &&
              result.analysis.urgencyReasons.length > 0 ? (
                <ul className="space-y-1.5 text-xs text-amber-950">
                  {result.analysis.urgencyReasons.map((r, idx) => (
                    <li
                      key={idx}
                      className="flex items-start justify-between gap-2 border-b border-amber-100/60 pb-1 last:border-0"
                    >
                      <div>
                        <span className="font-semibold">{r.rule_name}</span>:{" "}
                        <span className="italic font-mono text-amber-800">
                          "{r.matched_term}"
                        </span>
                        <p className="text-[10px] text-amber-700">
                          {r.description}
                        </p>
                      </div>
                      <span className="font-mono font-bold text-amber-700 whitespace-nowrap">
                        +{r.weight} pts
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-amber-800 italic">
                  No high-risk keywords or deadline triggers detected. Routine
                  low-priority queue.
                </p>
              )}
            </Card>
          </div>

          {/* Model Provenance Footer */}
          <div className="text-[10px] text-slate-400 font-mono flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span>Classifier: TF-IDF + LogisticRegression (v1.0.0)</span>
            <span>Sentiment: NLTK VADER Lexicon (v3.3.0)</span>
            <span>Emotion: Plutchik Rule Framework (v1.0)</span>
            <span>Urgency: Multi-Rule Risk Engine (v1.0)</span>
          </div>
        </div>
      )}
    </div>
  );
};
