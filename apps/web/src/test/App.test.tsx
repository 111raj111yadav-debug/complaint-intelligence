import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { App } from "../app/App.js";

// Mock the health-service API call so component tests run fast and deterministically
vi.mock("../services/health-service.js", () => ({
  fetchSystemReadiness: vi.fn().mockResolvedValue({
    status: "ready",
    service: "complaint-intelligence-api",
    timestamp: "2026-10-15T18:00:00.000Z",
    dependencies: {
      database: { healthy: true, latencyMs: 12 },
      nlpMicroservice: { available: true, latencyMs: 5 },
    },
  }),
  sendNlpPing: vi.fn().mockResolvedValue({
    success: true,
    echo: "Hello",
    notice: "Foundation-only endpoint",
  }),
}));
vi.mock("../services/auth-service.js", () => ({
  TOKEN_STORAGE_KEY: "complaint_intel_auth_token",
  demoLoginUser: vi.fn().mockResolvedValue({
    user: {
      id: "u-mock-1",
      email: "supervisor@complaint-intel.org",
      name: "Support Operations Supervisor",
      role: "MANAGER",
    },
    token: "mock-token",
  }),
  fetchCurrentUser: vi.fn().mockResolvedValue({
    id: "u-mock-1",
    email: "supervisor@complaint-intel.org",
    name: "Support Operations Supervisor",
    role: "MANAGER",
  }),
  logoutUser: vi.fn(),
  loginUser: vi.fn(),
}));

describe("Frontend Application Foundation", () => {
  it("renders the application layout and main navigation", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("Complaint Intel").length).toBeGreaterThan(0);
      expect(screen.getByText("Resolution Platform")).toBeInTheDocument();
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
      expect(screen.getByText("Complaints")).toBeInTheDocument();
      expect(screen.getByText("AI Analysis")).toBeInTheDocument();
    });
  });

  it("loads the main dashboard route with project objective and technology stack", async () => {
    render(<App />);

    const heading = await screen.findByText(
      /Intelligent Customer Complaint Analysis & Automatic Resolution Recommendation/i,
    );
    expect(heading).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Express API Backend")).toBeInTheDocument();
      expect(screen.getByText("Relational & Vector DB")).toBeInTheDocument();
      expect(screen.getByText("NLP Microservice")).toBeInTheDocument();
    });
  });
});
