import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RecommendationPanel } from "../features/complaints/components/RecommendationPanel.js";
import { ResolutionRecommendationItem } from "../types/index.js";

const mockRecommendation: ResolutionRecommendationItem = {
  id: "rec-123",
  complaintId: "cmp-456",
  suggestedSteps: [
    "Verify disputed credit card charge with merchant gateway",
    "Post temporary provisional credit under Regulation Z 12 CFR 1026.13",
    "Notify cardholder of 30-day investigation window",
  ],
  rationale:
    "Billing dispute protocol under Regulation Z requires prompt acknowledgment and provisional credit when notice is received within 60 days.",
  evidenceStrength: "HIGH",
  confidenceScore: 0.89,
  evidenceLimitations: [],
  humanReviewRequired: true,
  reviewReasons: ["Potential legal action or statutory inquiry mentioned"],
  modelProvider: "extractive_evidence_grounded",
  modelIdentifier: "rule-based-extractive-v1",
  promptVersion: "2.0.0-rag-resolution",
  status: "GENERATED",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  sources: [
    {
      id: "src-1",
      recommendationId: "rec-123",
      resolutionId: "res-789",
      similarityScore: 0.842,
      rank: 1,
      citationReason: "Playbook KB-CARD-001 match",
      resolution: {
        id: "res-789",
        referenceCode: "KB-CARD-001",
        title: "Unauthorized Fraudulent Charge Procedure",
        complaintText: "Customer noticed unrecognized charges...",
        resolutionText:
          "Block card, post provisional credit, initiate chargeback...",
        resolutionOutcome: "PROVISIONAL_CREDIT_ISSUED",
        category: "credit_card",
        departmentCode: "DEPT_CARDS",
        isVerified: true,
        verificationStatus: "VERIFIED",
        dataSource: "CFPB_REG_Z_PLAYBOOKS",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
  ],
};

describe("RecommendationPanel Component", () => {
  it("renders evidence strength, steps checklist, and human review warning banner", () => {
    render(
      <RecommendationPanel
        complaintId="cmp-456"
        complaintText="I was charged twice on my credit card."
        initialRecommendation={mockRecommendation}
      />,
    );

    expect(screen.getByText(/HIGH EVIDENCE STRENGTH/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Human Review & Oversight Mandated/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Potential legal action or statutory inquiry/i),
    ).toBeInTheDocument();

    // Suggested steps
    expect(
      screen.getByText(
        /Verify disputed credit card charge with merchant gateway/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Post temporary provisional credit under Regulation Z/i),
    ).toBeInTheDocument();

    // Rationale
    expect(
      screen.getByText(/Billing dispute protocol under Regulation Z/i),
    ).toBeInTheDocument();

    // Supporting Source
    expect(screen.getByText("KB-CARD-001")).toBeInTheDocument();
    expect(screen.getByText("84.2% match")).toBeInTheDocument();
  });

  it("allows toggling steps in the interactive checklist", () => {
    render(
      <RecommendationPanel
        complaintId="cmp-456"
        complaintText="I was charged twice on my credit card."
        initialRecommendation={mockRecommendation}
      />,
    );

    const stepItem = screen.getByText(
      /Verify disputed credit card charge with merchant gateway/i,
    );
    fireEvent.click(stepItem);

    // After clicking, the step container gets line-through / completed styling
    const stepParent = stepItem.closest(".cursor-pointer");
    expect(stepParent?.className).toContain("line-through");
  });

  it("renders empty state with generate button when no initial recommendation provided", () => {
    render(
      <RecommendationPanel
        complaintId="cmp-456"
        complaintText="I was charged twice on my credit card."
        initialRecommendation={null}
      />,
    );

    expect(
      screen.getByText(/AI-Assisted Resolution Recommendation/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Generate RAG Recommendation/i),
    ).toBeInTheDocument();
  });
});
