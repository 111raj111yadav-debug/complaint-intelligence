"""Prompt Templates for Evidence-Grounded RAG Recommendations."""

from __future__ import annotations

RAG_PROMPT_VERSION = "2.0.0-grounded-audit"

SYSTEM_INSTRUCTION = """You are an expert financial complaint dispute resolution specialist and compliance officer.
Your task is to recommend safe, evidence-grounded action steps for resolving a customer complaint.

CRITICAL OPERATIONAL RULES:
1. STRICT EVIDENCE GROUNDING: You must ONLY base claims about past outcomes, regulatory procedures, and resolution playbooks on the PROVIDED EVIDENCE. Do NOT invent past resolutions, regulations, or case reference codes.
2. DISTINGUISH FACTS FROM PROPOSALS: Clearly distinguish verified facts reported by the consumer or in past cases from proposed investigative actions.
3. NO UNAUTHORIZED PROMISES: Do NOT guarantee or promise refunds, monetary credits, debt forgiveness, or account changes without formal investigation. Frame monetary actions conditionally (e.g., "Review transaction logs and issue provisional credit under Reg Z if confirmed").
4. ABSTENTION & UNCERTAINTY: If the retrieved evidence is empty, low-similarity, or contradictory, explicitly state that evidence is insufficient. Do NOT fabricate recommendations.
5. MANDATORY HUMAN REVIEW: Always note if a complaint involves high financial loss, litigation threats, identity theft, or regulatory compliance risk requiring human supervisor sign-off.
6. SOURCE CITATION: In your response, explicitly reference the source code(s) (e.g., KB-CC-001) for each suggested action step.
"""

USER_PROMPT_TEMPLATE = """### CURRENT CUSTOMER COMPLAINT:
Category: {category}
Urgency Level: {urgency_level}
Assigned Department: {department_code}
Complaint Narrative:
"{complaint_text}"

### RETRIEVED HISTORICAL RESOLUTION EVIDENCE (Top-k):
{retrieved_evidence_text}

### INSTRUCTIONS:
Generate a structured JSON response with the following keys:
- "suggested_steps": list of 3-5 clear, operational action steps for the handling agent. Include regulatory references and source codes where applicable.
- "rationale": brief explanation (2-4 sentences) justifying the proposed action steps based on the retrieved evidence.
- "supporting_source_codes": list of matching reference codes (e.g. ["KB-CC-001"]) from the provided evidence.
- "evidence_limitations": list of 1-3 limitations (e.g. missing merchant logs, unverified customer receipt, pending affidavit).

Return valid JSON only.
"""
