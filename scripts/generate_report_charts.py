"""
Generate publication-quality academic diagrams and charts for the MCA Project Report and Presentation.
Colors: Restrained navy, slate, teal, white palette suitable for academic print and slides.
"""

import os
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "deliverables", "figures")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Set global matplotlib styling
plt.rcParams['font.family'] = 'DejaVu Sans'
plt.rcParams['font.size'] = 10
plt.rcParams['axes.titlesize'] = 12
plt.rcParams['axes.titleweight'] = 'bold'
plt.rcParams['axes.labelsize'] = 10
plt.rcParams['axes.labelweight'] = 'bold'

# 1. NLP Pipeline Flow Diagram
def generate_nlp_pipeline_diagram():
    fig, ax = plt.subplots(figsize=(10, 5.2), dpi=300)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    # Background canvas
    bg = patches.Rectangle((0, 0), 100, 100, facecolor='#F8FAFC', edgecolor='none')
    ax.add_patch(bg)

    def draw_box(x, y, w, h, title, subtitle, color='#1E3A8A', text_color='#FFFFFF', border_color='#0F172A'):
        box = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=1.2,rounding_size=2",
                                     facecolor=color, edgecolor=border_color, linewidth=1.2)
        ax.add_patch(box)
        ax.text(x + w/2, y + h*0.62, title, ha='center', va='center', fontsize=9.5, fontweight='bold', color=text_color)
        ax.text(x + w/2, y + h*0.28, subtitle, ha='center', va='center', fontsize=8, color=text_color, alpha=0.92)

    def draw_arrow(x1, y1, x2, y2, label=""):
        ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(facecolor='#0F172A', edgecolor='#0F172A', width=1.5, headwidth=6, headlength=6, shrink=0.08))
        if label:
            ax.text((x1+x2)/2, (y1+y2)/2 + 2, label, ha='center', va='bottom', fontsize=7.5, fontweight='bold', color='#334155')

    # Row 1: Intake & Preprocessing
    draw_box(4, 76, 26, 16, "1. Raw Intake & Normalization", "Unicode NFKC, HTML strip\nNegation preservation", '#0F172A')
    draw_arrow(30, 84, 38, 84)

    draw_box(38, 76, 26, 16, "2. Privacy & PII Redaction", "Regex: SSN, Cards, Email\nPhone, Account tokens", '#1E3A8A')
    draw_arrow(64, 84, 72, 84)

    draw_box(72, 76, 24, 16, "3. Feature Extraction", "TF-IDF sublinear (1,2)-grams\nDense 384-d MiniLM", '#0284C7')

    # Down arrow from Row 1 to Row 2
    draw_arrow(84, 76, 84, 62)

    # Row 2: Parallel Linguistic & Classification Inference
    draw_box(4, 46, 21, 16, "4a. Category Classifier", "TF-IDF + Logistic Reg.\nMacro F1 = 0.8385", '#1D4ED8')
    draw_box(27, 46, 21, 16, "4b. Sentiment Analysis", "NLTK VADER Lexicon\nCompound severity [-1, 1]", '#0284C7')
    draw_box(50, 46, 21, 16, "4c. Emotion Detection", "Plutchik Lexicon + Negation\nAnger, Fear, Sadness, etc.", '#0D9488')
    draw_box(73, 46, 23, 16, "4d. Explainable Urgency", "6-Rule Heuristic Scoring\nCritical, High, Med, Low", '#B45309')

    # Arrows to routing & embedding
    draw_arrow(14.5, 46, 14.5, 32)
    draw_arrow(37.5, 46, 37.5, 32)
    draw_arrow(60.5, 46, 60.5, 32)
    draw_arrow(84.5, 46, 84.5, 32)

    # Row 3: Routing, Retrieval & Generation
    draw_box(4, 16, 26, 16, "5. Department Routing", "Deterministic category map\nFallback & SLA triggers", '#334155')
    draw_arrow(30, 24, 38, 24)

    draw_box(38, 16, 26, 16, "6. pgvector Semantic Search", "all-MiniLM-L6-v2 + HNSW\nHit@3: 0.9333, Sub-5ms", '#047857')
    draw_arrow(64, 24, 72, 24)

    draw_box(72, 16, 24, 16, "7. Dual-Provider RAG", "Statutory citations + Playbook\nRisk rules & Abstention", '#6D28D9')

    # Down arrow to Human in the loop
    draw_arrow(84, 16, 84, 8)
    draw_box(20, 2, 60, 8, "8. Human-in-the-Loop Oversight & 3-Way Feedback", "Dispute Officer Review -> Accept As-Is / Modify / Reject with Mandatory Reason", '#111827')

    plt.tight_layout()
    fig_path = os.path.join(OUTPUT_DIR, "nlp_pipeline_flow.png")
    plt.savefig(fig_path, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Saved: {fig_path}")

# 2. System Architecture Flow Diagram
def generate_architecture_diagram():
    fig, ax = plt.subplots(figsize=(10, 5.0), dpi=300)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    bg = patches.Rectangle((0, 0), 100, 100, facecolor='#F8FAFC', edgecolor='none')
    ax.add_patch(bg)

    def draw_cluster(x, y, w, h, title, fill='#FFFFFF', border='#CBD5E1'):
        box = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=1.5,rounding_size=2",
                                     facecolor=fill, edgecolor=border, linewidth=1.5, linestyle='--')
        ax.add_patch(box)
        ax.text(x + 3, y + h - 4, title, fontsize=9.5, fontweight='bold', color='#475569')

    def draw_card(x, y, w, h, title, tech, fill='#1E3A8A', text_col='#FFFFFF'):
        card = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=1,rounding_size=2",
                                      facecolor=fill, edgecolor='#0F172A', linewidth=1.2)
        ax.add_patch(card)
        ax.text(x + w/2, y + h*0.62, title, ha='center', va='center', fontsize=9, fontweight='bold', color=text_col)
        ax.text(x + w/2, y + h*0.28, tech, ha='center', va='center', fontsize=7.5, color=text_col, alpha=0.92)

    def draw_connector(x1, y1, x2, y2, label=""):
        ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(facecolor='#1E293B', edgecolor='#1E293B', width=1.5, headwidth=6, headlength=6, shrink=0.08))
        if label:
            ax.text((x1+x2)/2, (y1+y2)/2 + 2, label, ha='center', va='bottom', fontsize=7.5, fontweight='bold', color='#1E293B')

    # Cluster 1: Client Layer
    draw_cluster(3, 10, 22, 82, "Client Layer")
    draw_card(5, 55, 18, 28, "Web Application", "React 18 + Vite\nTailwind CSS\nRole Switcher (RBAC)", '#0F172A')
    draw_card(5, 18, 18, 28, "Staff Roles", "Admin, Manager,\nAgent, Auditor\n(Zero-Credential Client)", '#334155')

    draw_connector(25, 69, 33, 69, "HTTPS / REST")

    # Cluster 2: API Gateway Layer
    draw_cluster(31, 10, 32, 82, "Application & Gateway Layer")
    draw_card(34, 60, 26, 24, "Express API Gateway", "Node.js 24 + TypeScript\nJWT Authentication\nRole-Based Access Control", '#1E3A8A')
    draw_card(34, 34, 26, 20, "Workflow State Machine", "Lifecycle Transition Rules\nReopen Justifications\nAudit Trail Logging", '#1D4ED8')
    draw_card(34, 14, 26, 16, "Prisma ORM Client", "Type-safe Data Access\nConnection Pooling", '#0284C7')

    draw_connector(63, 72, 69, 72, "Internal HTTP :8000")
    draw_connector(47, 14, 47, 6, "")

    # Cluster 3: NLP Service Layer
    draw_cluster(67, 48, 30, 44, "NLP & ML Microservice")
    draw_card(70, 72, 24, 16, "FastAPI Service", "Python 3.12 + PyTorch\nAsynchronous Endpoints", '#047857')
    draw_card(70, 52, 24, 16, "Inference Pipelines", "TF-IDF + LogReg | VADER\nPlutchik | MiniLM Embeddings", '#0D9488')

    draw_connector(82, 52, 82, 38, "Vector Cosine")

    # Cluster 4: Persistence Layer
    draw_cluster(67, 8, 30, 36, "Database & Vector Store")
    draw_card(70, 20, 24, 16, "PostgreSQL 16 + pgvector", "HNSW Index (384-d)\nRelational Entities + Vectors", '#4338CA')
    draw_card(70, 10, 24, 8, "Storage Volumes", "Complaints, KB Playbooks, Audits", '#312E81')

    # Connect API Gateway to DB
    draw_connector(60, 26, 70, 26, "TCP :5434")

    plt.tight_layout()
    fig_path = os.path.join(OUTPUT_DIR, "system_architecture.png")
    plt.savefig(fig_path, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Saved: {fig_path}")

# 3. Classification Performance & Confusion Matrix
def generate_classification_charts():
    categories = ['Credit Reporting', 'Retail Banking', 'Mortgages/Loans', 'Credit Card', 'Debt Collection']
    precision = [0.9312, 0.8458, 0.8079, 0.7535, 0.7678]
    recall = [0.8238, 0.9044, 0.8925, 0.8505, 0.8286]
    f1 = [0.8742, 0.8741, 0.8481, 0.7991, 0.7971]

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4.5), dpi=300)

    # Subplot 1: Bar chart of metrics
    x = np.arange(len(categories))
    width = 0.25

    rects1 = ax1.bar(x - width, precision, width, label='Precision', color='#1E3A8A')
    rects2 = ax1.bar(x, recall, width, label='Recall', color='#0284C7')
    rects3 = ax1.bar(x + width, f1, width, label='F1-Score', color='#0D9488')

    ax1.set_ylabel('Score (0.0 - 1.0)', fontweight='bold')
    ax1.set_title('Per-Class Performance on Held-Out Test Set (N=18,666)\nMacro-F1 = 0.8385 | Overall Accuracy = 84.69%')
    ax1.set_xticks(x)
    ax1.set_xticklabels(categories, rotation=20, ha='right', fontsize=8.5)
    ax1.set_ylim(0, 1.08)
    ax1.axhline(0.8385, color='#DC2626', linestyle='--', linewidth=1.2, label='Macro F1 (0.8385)')
    ax1.legend(loc='lower right', frameon=True, fontsize=8)
    ax1.grid(axis='y', linestyle=':', alpha=0.6)

    # Subplot 2: Normalized Confusion Matrix
    cm = np.array([
        [0.8505, 0.0392, 0.0240, 0.0116, 0.0748],
        [0.0402, 0.8238, 0.0766, 0.0524, 0.0070],
        [0.0326, 0.0938, 0.8286, 0.0304, 0.0146],
        [0.0182, 0.0420, 0.0260, 0.8925, 0.0214],
        [0.0654, 0.0054, 0.0089, 0.0159, 0.9044]
    ])
    short_cats = ['Card', 'Report', 'Debt', 'Mortg.', 'Bank']

    im = ax2.imshow(cm, interpolation='nearest', cmap=plt.cm.Blues)
    ax2.set_title('Normalized Confusion Matrix (Recall Rates along diagonal)')
    tick_marks = np.arange(len(short_cats))
    ax2.set_xticks(tick_marks)
    ax2.set_xticklabels(short_cats, rotation=20, fontsize=8.5)
    ax2.set_yticks(tick_marks)
    ax2.set_yticklabels(short_cats, fontsize=8.5)
    ax2.set_xlabel('Predicted Class', fontweight='bold')
    ax2.set_ylabel('True Class', fontweight='bold')

    # Annotate numbers in cells
    thresh = cm.max() / 2.
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            val = f"{cm[i, j]*100:.1f}%"
            ax2.text(j, i, val, ha="center", va="center",
                     color="white" if cm[i, j] > thresh else "black", fontsize=8, fontweight='bold')

    plt.tight_layout()
    fig_path = os.path.join(OUTPUT_DIR, "classification_metrics.png")
    plt.savefig(fig_path, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Saved: {fig_path}")

# 4. Semantic Retrieval Benchmark Comparison
def generate_retrieval_chart():
    fig, ax = plt.subplots(figsize=(8, 4.2), dpi=300)

    metrics = ['Hit@1', 'Hit@3', 'Hit@5', 'Recall@3', 'MRR']
    dense_scores = [0.8000, 0.9333, 0.9333, 0.8667, 0.8611]
    tfidf_scores = [0.8000, 0.8667, 0.9000, 0.7667, 0.8344]

    x = np.arange(len(metrics))
    width = 0.35

    rects1 = ax.bar(x - width/2, dense_scores, width, label='Dense Semantic (all-MiniLM-L6-v2 + pgvector)', color='#047857')
    rects2 = ax.bar(x + width/2, tfidf_scores, width, label='Lexical Baseline (TF-IDF + Cosine)', color='#64748B')

    ax.set_ylabel('Evaluation Score (0.0 - 1.0)', fontweight='bold')
    ax.set_title('Expanded Semantic Retrieval Benchmark Results (N=35 Queries: 30 In-Domain + 5 Out-of-Domain)')
    ax.set_xticks(x)
    ax.set_xticklabels(metrics, fontsize=9.5, fontweight='bold')
    ax.set_ylim(0, 1.12)
    ax.legend(loc='lower right', frameon=True, fontsize=8.5)
    ax.grid(axis='y', linestyle=':', alpha=0.6)

    # Annotate values
    for rect in rects1:
        h = rect.get_height()
        ax.annotate(f'{h:.4f}', xy=(rect.get_x() + rect.get_width()/2, h), xytext=(0, 3),
                    textcoords="offset points", ha='center', va='bottom', fontsize=7.5, fontweight='bold', color='#047857')
    for rect in rects2:
        h = rect.get_height()
        ax.annotate(f'{h:.4f}', xy=(rect.get_x() + rect.get_width()/2, h), xytext=(0, 3),
                    textcoords="offset points", ha='center', va='bottom', fontsize=7.5, color='#475569')

    plt.tight_layout()
    fig_path = os.path.join(OUTPUT_DIR, "retrieval_benchmark.png")
    plt.savefig(fig_path, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Saved: {fig_path}")

# 5. Recommendation Evaluation Rubric Chart
def generate_rubric_chart():
    fig, ax = plt.subplots(figsize=(8, 4.0), dpi=300)

    dimensions = [
        'Relevance to\nComplaint',
        'Evidence\nGrounding',
        'Citation\nAccuracy',
        'Actionability\nof Steps',
        'Safety & Policy\nCompliance',
        'Escalation/Abstention\nAccuracy'
    ]
    scores = [5.00, 4.83, 4.83, 5.00, 5.00, 4.33]  # 4.33 represents 86.67% on a 5-point scale (0.8667 * 5)
    max_scores = [5.0, 5.0, 5.0, 5.0, 5.0, 5.0]

    x = np.arange(len(dimensions))
    width = 0.45

    rects = ax.bar(x, scores, width, color='#6D28D9', edgecolor='#4C1D95', linewidth=1.2)
    ax.set_ylabel('Mean Rubric Score (Max = 5.0)', fontweight='bold')
    ax.set_title('Phase 3 RAG Recommendation Quality Rubric Evaluation (15 Cases, 0 Hallucinations)')
    ax.set_xticks(x)
    ax.set_xticklabels(dimensions, fontsize=8.5)
    ax.set_ylim(0, 5.6)
    ax.grid(axis='y', linestyle=':', alpha=0.6)

    # Annotate score text
    for i, rect in enumerate(rects):
        h = rect.get_height()
        label = f"{h:.2f} / 5.0" if i < 5 else "86.7% (13/15)"
        ax.annotate(label, xy=(rect.get_x() + rect.get_width()/2, h), xytext=(0, 4),
                    textcoords="offset points", ha='center', va='bottom', fontsize=8, fontweight='bold', color='#4C1D95')

    plt.tight_layout()
    fig_path = os.path.join(OUTPUT_DIR, "recommendation_rubric.png")
    plt.savefig(fig_path, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Saved: {fig_path}")

if __name__ == "__main__":
    generate_nlp_pipeline_diagram()
    generate_architecture_diagram()
    generate_classification_charts()
    generate_retrieval_chart()
    generate_rubric_chart()
    print("All charts generated successfully.")
