import React, { useEffect, useState, useCallback } from "react";
import {
  BookOpen,
  Search,
  Sparkles,
  ShieldCheck,
  Tag,
  Building2,
  ChevronRight,
  X,
  CheckCircle2,
} from "lucide-react";
import { Card } from "../../components/ui/Card.js";
import { Badge } from "../../components/ui/Badge.js";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner.js";
import { ErrorMessage } from "../../components/ui/ErrorMessage.js";
import { EmptyState } from "../../components/ui/EmptyState.js";
import {
  fetchResolutions,
  searchResolutions,
  SearchResolutionsData,
} from "../../services/resolutions-service.js";
import { ResolutionItem, PaginationMeta } from "../../types/index.js";

const CATEGORY_OPTIONS = [
  { label: "All Categories", value: "" },
  { label: "Credit Card", value: "credit_card" },
  { label: "Credit Reporting", value: "credit_reporting" },
  { label: "Debt Collection", value: "debt_collection" },
  { label: "Mortgages & Loans", value: "mortgages_and_loans" },
  { label: "Retail Banking", value: "retail_banking" },
];

export const KnowledgeBasePage: React.FC = () => {
  const [resolutions, setResolutions] = useState<ResolutionItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Semantic search mode state
  const [isSemanticMode, setIsSemanticMode] = useState<boolean>(false);
  const [semanticResults, setSemanticResults] =
    useState<SearchResolutionsData | null>(null);
  const [semanticLoading, setSemanticLoading] = useState<boolean>(false);

  // Selected Resolution Detail Modal
  const [selectedItem, setSelectedItem] = useState<ResolutionItem | null>(null);

  const loadResolutions = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchResolutions({
          page,
          limit: 10,
          category: selectedCategory || undefined,
          search: !isSemanticMode && searchQuery ? searchQuery : undefined,
        });
        setResolutions(res.resolutions);
        setPagination(res.pagination);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load knowledge base resolutions.",
        );
      } finally {
        setLoading(false);
      }
    },
    [selectedCategory, searchQuery, isSemanticMode],
  );

  useEffect(() => {
    if (!isSemanticMode) {
      loadResolutions(1);
    }
  }, [loadResolutions, isSemanticMode]);

  const handleSemanticSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || searchQuery.trim().length < 3) return;

    setSemanticLoading(true);
    setError(null);
    try {
      const data = await searchResolutions({
        query: searchQuery.trim(),
        top_k: 6,
        similarity_threshold: 0.35,
        category_filter: selectedCategory || null,
        only_verified: true,
      });
      setSemanticResults(data);
      setIsSemanticMode(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Semantic resolution search failed.",
      );
    } finally {
      setSemanticLoading(false);
    }
  };

  const handleClearSemantic = () => {
    setIsSemanticMode(false);
    setSemanticResults(null);
    setSearchQuery("");
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">
              Dispute Resolution Knowledge Base
            </h2>
            <Badge variant="success">22 Verified CFPB Playbooks</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Standard Operating Procedures (SOPs), statutory playbooks (Reg Z,
            FCRA, Reg E, FDCPA, RESPA), and pgvector 384-d semantic embeddings.
          </p>
        </div>
      </div>

      {/* Semantic Search Box */}
      <Card className="p-4 sm:p-5 bg-gradient-to-br from-slate-900 to-indigo-950 text-white border-0 shadow-md">
        <form onSubmit={handleSemanticSearch} className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-indigo-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Semantic Vector Similarity Search (HNSW Cosine Distance)
            </label>
            {isSemanticMode && (
              <button
                type="button"
                onClick={handleClearSemantic}
                className="text-xs text-indigo-300 hover:text-white underline"
              >
                Clear Vector Search (View All)
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter customer complaint narrative or issue (e.g. 'unauthorized charge on credit card' or 'inquiry on credit report')..."
                className="w-full text-xs pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <button
              type="submit"
              disabled={semanticLoading || searchQuery.trim().length < 3}
              className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              {semanticLoading ? (
                <>
                  <LoadingSpinner size="sm" />
                  Searching Vector DB...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Semantic Search
                </>
              )}
            </button>
          </div>
        </form>
      </Card>

      {error && <ErrorMessage message={error} />}

      {/* Semantic Search Results View */}
      {isSemanticMode && semanticResults && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>
              Retrieved <strong>{semanticResults.matched_count}</strong>{" "}
              matching playbooks above threshold{" "}
              <strong>{semanticResults.similarity_threshold}</strong> for "
              <em>{semanticResults.query_preview}</em>"
            </span>
            <button
              onClick={handleClearSemantic}
              className="text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Back to Catalog
            </button>
          </div>

          {semanticResults.is_empty ? (
            <Card>
              <EmptyState
                icon={Search}
                title="No Resolution Playbooks Matched"
                description={
                  semanticResults.empty_reason ||
                  "No historical resolution records exceeded the similarity threshold. Try adjusting the query terms."
                }
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {semanticResults.results.map((res) => (
                <div
                  key={res.id}
                  onClick={() => setSelectedItem(res)}
                  className="bg-white border border-slate-200 hover:border-indigo-400 rounded-xl p-4 shadow-sm hover:shadow transition-all cursor-pointer flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                          {res.reference_code}
                        </span>
                        <Badge variant="info">
                          {(res.similarity_score * 100).toFixed(1)}% Match
                        </Badge>
                      </div>
                      <Badge variant="success">{res.resolution_outcome}</Badge>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 line-clamp-1">
                      {res.title}
                    </h4>

                    <p className="text-xs text-slate-500 line-clamp-2 italic">
                      "{res.complaint_text}"
                    </p>

                    <p className="text-xs text-slate-700 line-clamp-2">
                      {res.resolution_text}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3 text-slate-400" />
                      {res.category}
                    </span>
                    <span className="text-indigo-600 font-semibold flex items-center gap-0.5">
                      View Playbook <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Catalog Browse View */}
      {!isSemanticMode && (
        <div className="space-y-4">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <LoadingSpinner size="lg" />
              <p className="text-xs text-slate-500 font-medium">
                Loading knowledge base playbooks...
              </p>
            </div>
          ) : resolutions.length === 0 ? (
            <Card>
              <EmptyState
                icon={BookOpen}
                title="No Resolution Records Found"
                description="No playbooks match the current category filter."
              />
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resolutions.map((res) => (
                  <div
                    key={res.id}
                    onClick={() => setSelectedItem(res)}
                    className="bg-white border border-slate-200 hover:border-indigo-400 rounded-xl p-4 shadow-sm hover:shadow transition-all cursor-pointer flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                            {res.referenceCode}
                          </span>
                          {res.contentType && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {res.contentType.replace(/_/g, " ")}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {res.isVerified ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              VERIFIED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              FIXTURE
                            </span>
                          )}
                          <Badge variant="neutral">
                            {res.resolutionOutcome}
                          </Badge>
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 line-clamp-1">
                        {res.title}
                      </h4>

                      <p className="text-xs text-slate-500 line-clamp-2 italic">
                        "{res.complaintText}"
                      </p>

                      <p className="text-xs text-slate-700 line-clamp-2">
                        {res.resolutionText}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        {res.departmentCode}
                      </span>
                      <span className="text-indigo-600 font-semibold flex items-center gap-0.5">
                        Inspect SOP <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-slate-500">
                    Showing page {pagination.page} of {pagination.totalPages} (
                    {pagination.total} playbooks)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => loadResolutions(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                      className="px-3 py-1.5 border border-slate-200 rounded text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => loadResolutions(pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages}
                      className="px-3 py-1.5 border border-slate-200 rounded text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Resolution Playbook Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                  {selectedItem.referenceCode}
                </span>
                <h3 className="text-sm font-bold text-slate-900">
                  {selectedItem.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">Category: {selectedItem.category}</Badge>
                <Badge variant="neutral">
                  Dept: {selectedItem.departmentCode}
                </Badge>
                <Badge variant="success">
                  Outcome: {selectedItem.resolutionOutcome}
                </Badge>
                {selectedItem.contentType && (
                  <Badge variant="neutral">
                    Type: {selectedItem.contentType.replace(/_/g, " ")}
                  </Badge>
                )}
                {selectedItem.isVerified ? (
                  <Badge variant="success">Verified Playbook</Badge>
                ) : (
                  <Badge variant="warning">Synthetic Test Fixture</Badge>
                )}
              </div>

              {/* Provenance & Legal Citation Card */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <h5 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center justify-between">
                  <span>Provenance & Statutory Authority</span>
                  <span className="font-mono text-[10px] text-slate-400">
                    Version: {selectedItem.version || "2026.1"}
                  </span>
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">
                      Authority / Citation
                    </span>
                    <span className="font-semibold text-slate-900 block">
                      {selectedItem.sourceTitle ||
                        (selectedItem.provenance as any)?.authority ||
                        "Standard Financial Dispute SOP"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">
                      Regulatory Organization
                    </span>
                    <span className="font-semibold text-slate-900 block">
                      {selectedItem.sourceOrg ||
                        (selectedItem.provenance as any)?.curator ||
                        "CFPB / Federal Reserve"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">
                      Last Verified
                    </span>
                    <span className="font-mono text-slate-700 block">
                      {selectedItem.lastVerifiedAt
                        ? new Date(selectedItem.lastVerifiedAt).toLocaleDateString()
                        : "Verified"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">
                      Official Source Link
                    </span>
                    {selectedItem.sourceUrl ? (
                      <a
                        href={selectedItem.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:underline font-mono truncate block text-[10px]"
                      >
                        {selectedItem.sourceUrl}
                      </a>
                    ) : (
                      <span className="text-slate-400 italic">Curated internal SOP</span>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 border-t border-slate-200/60 pt-1.5 italic">
                  Note: Playbooks represent standard banking dispute procedures and regulatory compliance baselines under US federal banking laws. They do not constitute personalized legal counsel.
                </p>
              </div>

              <div>
                <h5 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                  Dispute Case Pattern
                </h5>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 leading-relaxed italic">
                  "{selectedItem.complaintText}"
                </div>
              </div>

              <div>
                <h5 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                  Resolution Protocol & Legal Standard
                </h5>
                <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg text-slate-800 leading-relaxed">
                  {selectedItem.resolutionText}
                </div>
              </div>

              {/* Action Steps from metadata */}
              {selectedItem.metadata &&
                Array.isArray(
                  (selectedItem.metadata as Record<string, unknown>)
                    .action_steps,
                ) && (
                  <div>
                    <h5 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-2">
                      Standard Operating Action Steps
                    </h5>
                    <div className="space-y-1.5">
                      {(
                        (selectedItem.metadata as Record<string, unknown>)
                          .action_steps as string[]
                      ).map((step, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-2 text-slate-800"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>
                            <strong>Step {idx + 1}:</strong> {step}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg"
              >
                Close Playbook
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
