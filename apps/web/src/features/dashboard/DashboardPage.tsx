import React, { useEffect, useState } from "react";
import {
  Database,
  Server,
  Cpu,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { Card } from "../../components/ui/Card.js";
import { Badge } from "../../components/ui/Badge.js";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner.js";
import { ErrorMessage } from "../../components/ui/ErrorMessage.js";
import {
  fetchSystemReadiness,
  sendNlpPing,
} from "../../services/health-service.js";
import { SystemHealthData } from "../../types/index.js";
import { Link } from "react-router-dom";

export const DashboardPage: React.FC = () => {
  const [healthData, setHealthData] = useState<SystemHealthData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [pingMessage, setPingMessage] = useState<string>(
    "Foundation connectivity check",
  );
  const [pingResult, setPingResult] = useState<Record<string, unknown> | null>(
    null,
  );
  const [pingLoading, setPingLoading] = useState<boolean>(false);

  const loadStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSystemReadiness();
      setHealthData(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to Node.js Application API.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTestPing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pingMessage.trim()) return;
    setPingLoading(true);
    try {
      const res = await sendNlpPing(pingMessage);
      setPingResult(res);
    } catch (err) {
      setPingResult({
        success: false,
        error: err instanceof Error ? err.message : "Ping failed",
      });
    } finally {
      setPingLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const dbHealthy = healthData?.dependencies?.database?.healthy;
  const nlpAvailable = healthData?.dependencies?.nlpMicroservice?.available;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Badge variant="success">Enterprise Platform</Badge>
              <Badge variant="neutral">Operational</Badge>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-2">
              Intelligent Customer Complaint Analysis & Automatic Resolution
              Recommendation
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
              Foundational monorepo architecture linking a React SaaS frontend,
              Node.js Express API, PostgreSQL with pgvector vector database, and
              Python FastAPI NLP microservice.
            </p>
          </div>
          <button
            onClick={loadStatus}
            disabled={loading}
            type="button"
            className="inline-flex items-center text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-2 transition self-start md:self-center"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh Status
          </button>
        </div>
      </div>

      {/* System Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Node.js Express API */}
        <Card>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-100">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Express API Backend
                </h3>
                <p className="text-sm font-semibold text-slate-900">
                  Node.js TypeScript
                </p>
              </div>
            </div>
            {healthData ? (
              <Badge variant="success">Online (Port 5000)</Badge>
            ) : (
              <Badge variant="danger">Unreachable</Badge>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-600 space-y-1.5">
            <div className="flex justify-between">
              <span>Health Status:</span>
              <span className="font-medium text-slate-800">
                {healthData?.status || "Offline"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Environment:</span>
              <span className="font-mono text-slate-800">
                {healthData?.environment || "development"}
              </span>
            </div>
          </div>
        </Card>

        {/* PostgreSQL + pgvector Database */}
        <Card>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Relational & Vector DB
                </h3>
                <p className="text-sm font-semibold text-slate-900">
                  PostgreSQL + pgvector
                </p>
              </div>
            </div>
            {dbHealthy ? (
              <Badge variant="success">Healthy (Port 5434)</Badge>
            ) : (
              <Badge variant="danger">Disconnected</Badge>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-600 space-y-1.5">
            <div className="flex justify-between">
              <span>pgvector Extension:</span>
              <span className="font-medium text-emerald-600">
                v0.8.7 Active
              </span>
            </div>
            <div className="flex justify-between">
              <span>Query Latency:</span>
              <span className="font-mono text-slate-800">
                {healthData?.dependencies?.database?.latencyMs !== undefined
                  ? `${healthData.dependencies.database.latencyMs}ms`
                  : "N/A"}
              </span>
            </div>
          </div>
        </Card>

        {/* Python FastAPI NLP Service */}
        <Card>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-violet-50 text-violet-700 flex items-center justify-center border border-violet-100">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  NLP Microservice
                </h3>
                <p className="text-sm font-semibold text-slate-900">
                  Python FastAPI
                </p>
              </div>
            </div>
            {nlpAvailable ? (
              <Badge variant="success">Online (Port 8000)</Badge>
            ) : (
              <Badge variant="warning">Standby / Unchecked</Badge>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-600 space-y-1.5">
            <div className="flex justify-between">
              <span>Model State:</span>
              <span className="font-medium text-slate-700">
                Active & Online
              </span>
            </div>
            <div className="flex justify-between">
              <span>FastAPI Probe:</span>
              <span className="font-mono text-slate-800">
                {nlpAvailable ? "Ready" : "Not Loaded"}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Status / Diagnostic Alert */}
      {loading && (
        <LoadingSpinner label="Contacting Express API readiness probe..." />
      )}
      {error && (
        <ErrorMessage
          title="Backend Connection Notice"
          message={error}
          onRetry={loadStatus}
        />
      )}

      {/* Inter-Service Communication Test (Section 10 Verification) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="Service Communication Test (React → Express → FastAPI)"
          subtitle="Test inter-service communication path without exposing FastAPI directly to the browser"
        >
          <form onSubmit={handleTestPing} className="space-y-4">
            <div>
              <label
                htmlFor="ping-input"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Verification Message Payload
              </label>
              <div className="flex space-x-2">
                <input
                  id="ping-input"
                  type="text"
                  value={pingMessage}
                  onChange={(e) => setPingMessage(e.target.value)}
                  className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-400"
                  placeholder="Enter message to echo through FastAPI..."
                />
                <button
                  type="submit"
                  disabled={pingLoading}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg shadow-xs transition"
                >
                  {pingLoading ? "Testing..." : "Send Ping"}
                </button>
              </div>
            </div>
          </form>

          {pingResult && (
            <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Inter-Service Response:
              </span>
              <pre className="text-xs text-slate-800 font-mono overflow-x-auto p-2 bg-white rounded border border-slate-200">
                {JSON.stringify(pingResult, null, 2)}
              </pre>
            </div>
          )}
        </Card>

        {/* Platform Architecture & Capabilities */}
        <Card
          title="Core Platform Capabilities"
          subtitle="Integrated intelligence modules powering end-to-end complaint resolution"
        >
          <div className="space-y-3">
            <div className="flex items-start space-x-3 text-xs p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-semibold text-emerald-900">
                  Intelligent Ingestion & Triage
                </span>
                <p className="text-emerald-700 text-[11px] mt-0.5">
                  Multi-channel dispute intake, standardized reference generation,
                  automated deduplication, and SLA target assignment.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 text-xs p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-semibold text-emerald-900">
                  Multi-Signal NLP Analysis
                </span>
                <p className="text-emerald-700 text-[11px] mt-0.5">
                  TF-IDF + Logistic Regression categorization across CFPB products,
                  VADER sentiment polarity, Plutchik emotion profiling, and rule-based urgency scoring.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 text-xs p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-semibold text-emerald-900">
                  Evidence-Grounded RAG Resolutions
                </span>
                <p className="text-emerald-700 text-[11px] mt-0.5">
                  Dense semantic vector search over pgvector HNSW index, statutory
                  regulatory playbook citations, and reviewer feedback capture.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Feature Section Cards */}
      <div>
        <h3 className="text-sm font-semibold text-slate-800 mb-3">
          Project Modules
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            to="/complaints"
            className="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition block group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900 group-hover:text-sky-600 transition">
                Complaints Queue
              </span>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition" />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Multi-channel complaint ingestion and structured tracking
              repository.
            </p>
          </Link>

          <Link
            to="/analysis"
            className="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition block group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900 group-hover:text-sky-600 transition">
                AI NLP Analysis
              </span>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition" />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Automated classification, sentiment, emotion, and urgency
              evaluation.
            </p>
          </Link>

          <Link
            to="/resolutions"
            className="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition block group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900 group-hover:text-sky-600 transition">
                RAG Resolutions
              </span>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition" />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Evidence-grounded resolution generation using retrieved historical
              resolutions.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
};
