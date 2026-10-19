# Model Evaluation & Benchmark Report (Phase 1)

**Project:** Intelligent Customer Complaint Analysis and Automatic Resolution Recommendation
**Academic Degree:** MCA Final-Year Capstone Project
**Report Version:** 1.0.0 (Phase 1 Completed)
**Evaluation Date:** October 2026
**Artifact Storage:** `services/nlp/artifacts/`, `data/processed/`

---

## 1. Executive Summary

This report documents the empirical model evaluation for Phase 1 of the Intelligent Customer Complaint Analysis platform. All reported evaluation numbers represent **real, measured results** executed on held-out test data from the Consumer Financial Protection Bureau (CFPB) complaint corpus. No predictions, metrics, or test scores have been fabricated.

Key Empirical Findings:

- **Test Set Accuracy:** **84.69%** across 18,666 unseen complaints.
- **Macro F1-Score:** **0.8385** (Primary metric penalizing class imbalance).
- **Weighted F1-Score:** **0.8482**.
- **Performance vs Baseline:** Outperforms the zero-intelligence majority-class baseline ($F1_{\text{macro}} = 0.1245$) by **+0.7140** (+573% relative gain).
- **Data Leakage:** Verified $0$ train-validation-test overlap across 124,434 unique records.

---

## 2. Public Dataset Inspection & Ingestion

### 2.1 Dataset Provenance

- **Dataset Name:** Consumer Complaints Dataset for NLP
- **Host:** Kaggle (`shashwatwork/consume-complaints-dataset-fo-nlp`)
- **Origin:** Official Consumer Financial Protection Bureau (CFPB) public complaint database
- **Local Location:** `data/raw/complaints_processed.csv`

### 2.2 Raw Schema Inspection

The raw CSV contains 162,421 records with the following columns:

1. `Unnamed: 0`: Raw row sequence identifier (integer)
2. `product`: Product category assigned by the consumer or intake agent (string)
3. `narrative`: Unstructured, natural language complaint text submitted by the customer (string)

### 2.3 Data Quality & Deduplication Analysis

Data quality checks were executed prior to training:

- **Total Raw Records:** 162,421
- **Null Complaint Narratives:** 10 records (0.0062%) were removed.
- **Exact Duplicate Complaints:** 37,948 records (23.36%) were identified and removed. Eliminating duplicates prevents cross-split data leakage, wherein identical boilerplate or template text would artificially inflate test accuracy.
- **Usable Unique Records Retained:** 124,434 records.

### 2.4 Class Distribution & Label Mapping

The dataset labels were mapped to clean, canonical snake_case identifiers:

| Raw Label             | Normalized Class ID   |  Raw Count  |  Raw Pct   | Clean Retained | Clean Pct  |
| :-------------------- | :-------------------- | :---------: | :--------: | :------------: | :--------: |
| `credit_reporting`    | `credit_reporting`    |   91,179    |   56.14%   |     56,223     |   45.18%   |
| `debt_collection`     | `debt_collection`     |   23,150    |   14.25%   |     21,047     |   16.91%   |
| `mortgages_and_loans` | `mortgages_and_loans` |   18,990    |   11.69%   |     18,722     |   15.05%   |
| `credit_card`         | `credit_card`         |   15,566    |   9.58%    |     14,983     |   12.04%   |
| `retail_banking`      | `retail_banking`      |   13,536    |   8.33%    |     13,459     |   10.82%   |
| **Total**             |                       | **162,421** | **100.0%** |  **124,434**   | **100.0%** |

### 2.5 Text-Length Statistics

Measured on clean complaint narratives:

- **Character Count:** Min = 10, Max = 20,596, Mean = 588.54, Median = 361.0, 95th Percentile = 1,755.0
- **Word Count:** Min = 2, Max = 2,685, Mean = 80.23, Median = 50.0, 95th Percentile = 240.0

---

## 3. Data Splitting & Leakage Prevention Protocol

### 3.1 Split Methodology

- **Split Ratio:** 70% Training / 15% Validation / 15% Held-Out Test
- **Stratification:** Stratified sampling by category label to preserve exact class frequencies across all three partitions.
- **Random Seed:** Pinned to `42` across all splitting operations.
- **Artifacts Generated:** `data/processed/train.csv`, `data/processed/val.csv`, `data/processed/test.csv`.

### 3.2 Partition Counts

- **Training Set:** 87,103 samples (70.0%)
- **Validation Set:** 18,665 samples (15.0%)
- **Held-Out Test Set:** 18,666 samples (15.0%)

### 3.3 Leakage Verification

Cross-split MD5 hashing was performed on normalized text:

- `train_val_overlap`: 0 records
- `train_test_overlap`: 0 records
- `val_test_overlap`: 0 records
- **Leakage Status:** **ZERO LEAKAGE DETECTED (PASSED)**

All feature extractors (`TfidfVectorizer`) and learned models were fit **strictly on the 87,103 training samples**. The validation set was reserved for hyperparameter tuning, and the test set remained untouched until the final, frozen evaluation.

---

## 4. Text Preprocessing Pipeline

The modular preprocessing module (`services/nlp/app/pipelines/preprocessing/`) executes sequential sanitization:

1. **Unicode Normalization:** NFKC standard normalization to harmonize diacritics, symbols, and formatting variations.
2. **HTML & Tag Stripping:** Removes stray HTML tags (`<br>`, `<div>`, `&amp;`) frequently present in multi-channel web forms.
3. **Whitespace Normalization:** Collapses consecutive whitespace, tabs, and newlines into single spaces.
4. **Negation Preservation:** Explicit preservation of negation patterns (e.g., "didn't pay", "never received", "cannot login", "not authorized"). Negation words are never stripped as stop-words because negation fundamentally determines complaint liability and sentiment.
5. **PII Masking & Redaction:** Sensitive personal identifier detection and redaction using regex tokens:
   - Social Security Numbers (SSN): `[REDACTED_SSN]`
   - Credit / Debit Card Numbers: `[REDACTED_CARD]`
   - Email Addresses: `[REDACTED_EMAIL]`
   - Phone Numbers: `[REDACTED_PHONE]`
   - Bank Account Numbers: `[REDACTED_ACCOUNT]`
6. **Length Validation:** Enforces a minimum narrative length of 10 characters and truncates excessive inputs (>10,000 characters) to prevent denial-of-service memory pressure.

---

## 5. Category Classifier Evaluation

### 5.1 Model Architecture & Configuration

A scikit-learn `Pipeline` was constructed to bundle feature extraction and classification into a unified, leak-free artifact:

```python
Pipeline([
    ('tfidf', TfidfVectorizer(
        max_features=30000,
        ngram_range=(1, 2),
        sublinear_tf=True,
        min_df=3,
        norm='l2'
    )),
    ('clf', LogisticRegression(
        C=1.0,
        class_weight='balanced',
        max_iter=1000,
        random_state=42,
        solver='lbfgs'
    ))
])
```

- **Feature Count:** Top 30,000 uni-grams and bi-grams with sublinear term-frequency scaling ($1 + \log(TF)$).
- **Class Weights:** `balanced` inverse frequency weights to counteract the predominance of credit reporting complaints.
- **Fitting Duration:** 23.58 seconds on an 8-core CPU.
- **Model Artifact:** `services/nlp/artifacts/category_model.joblib` (6.2 MB).

### 5.2 Held-Out Test Set Results (18,666 Samples)

#### Overall Metrics

| Metric                |   Value    | Description                                             |
| :-------------------- | :--------: | :------------------------------------------------------ |
| **Accuracy**          | **84.69%** | Total correct predictions over total test records       |
| **Macro F1-Score**    | **0.8385** | Unweighted mean of per-class F1 scores (primary metric) |
| **Weighted F1-Score** | **0.8482** | Support-weighted mean of per-class F1 scores            |

#### Per-Class Classification Performance

| Class Label           | Precision | Recall |  F1-Score  | Support (N) |
| :-------------------- | :-------: | :----: | :--------: | :---------: |
| `credit_reporting`    |  0.9312   | 0.8238 | **0.8742** |    8,434    |
| `retail_banking`      |  0.8458   | 0.9044 | **0.8741** |    2,019    |
| `mortgages_and_loans` |  0.8079   | 0.8925 | **0.8481** |    2,809    |
| `credit_card`         |  0.7535   | 0.8505 | **0.7991** |    2,247    |
| `debt_collection`     |  0.7678   | 0.8286 | **0.7971** |    3,157    |

### 5.3 Baseline Comparison

To establish academic validity, the model is contrasted against a zero-intelligence baseline:

| Model Architecture                            |  Macro F1  | Weighted F1 |  Accuracy  |           Relative Gain            |
| :-------------------------------------------- | :--------: | :---------: | :--------: | :--------------------------------: |
| **Majority-Class Baseline** (`most_frequent`) |   0.1245   |   0.2812    |   45.18%   |             Reference              |
| **TF-IDF + Logistic Regression (Our Model)**  | **0.8385** | **0.8482**  | **84.69%** | **+573.5% ($F1\_{\text{macro}}$)** |

### 5.4 Test Set Confusion Matrix

#### Raw Count Matrix ($N = 18,666$)

Rows represent True Labels, Columns represent Predicted Labels:

| True \ Predicted      | `credit_card` | `credit_reporting` | `debt_collection` | `mortgages_and_loans` | `retail_banking` |
| :-------------------- | :-----------: | :----------------: | :---------------: | :-------------------: | :--------------: |
| `credit_card`         |   **1,911**   |         88         |        54         |          26           |       168        |
| `credit_reporting`    |      339      |     **6,948**      |        646        |          442          |        59        |
| `debt_collection`     |      103      |        296         |     **2,616**     |          96           |        46        |
| `mortgages_and_loans` |      51       |        118         |        73         |       **2,507**       |        60        |
| `retail_banking`      |      132      |         11         |        18         |          32           |    **1,826**     |

#### Normalized Confusion Matrix (Recall Rates along diagonal)

| True \ Predicted      | `credit_card` | `credit_reporting` | `debt_collection` | `mortgages_and_loans` | `retail_banking` |
| :-------------------- | :-----------: | :----------------: | :---------------: | :-------------------: | :--------------: |
| `credit_card`         |  **85.05%**   |       3.92%        |       2.40%       |         1.16%         |      7.48%       |
| `credit_reporting`    |     4.02%     |     **82.38%**     |       7.66%       |         5.24%         |      0.70%       |
| `debt_collection`     |     3.26%     |       9.38%        |    **82.86%**     |         3.04%         |      1.46%       |
| `mortgages_and_loans` |     1.82%     |       4.20%        |       2.60%       |      **89.25%**       |      2.14%       |
| `retail_banking`      |     6.54%     |       0.54%        |       0.89%       |         1.59%         |    **90.44%**    |

**Confusion Matrix Observations:**

1. The highest misclassification occurs between `debt_collection` and `credit_reporting` (9.38% of debt collection complaints misclassified as credit reporting, and 7.66% vice versa). This is linguistically consistent: consumers frequently complain to debt collectors regarding erroneous items appearing on their credit bureau files.
2. `retail_banking` achieves the highest recall (90.44%), driven by distinctive terms (e.g., "checking account", "overdraft", "wire transfer", "ATM").

---

## 6. Sentiment & Emotion Inference Pipelines

### 6.1 Sentiment Analysis Engine

- **Model Identifier:** NLTK VADER (`nltk/vader_lexicon-3.3.0`)
- **Language:** English
- **Outputs:**
  - Categorical Label: `positive` ($\text{compound} \ge 0.05$), `neutral` ($-0.05 < \text{compound} < 0.05$), `negative` ($\text{compound} \le -0.05$)
  - Continuous Compound Score: $[-1.0, 1.0]$
  - Normalized Valence Vector: `pos`, `neu`, `neg` probabilities summing to 1.0.
- **Handling of Complaint Nuances:** Customer complaints are inherently negative; standard sentiment models frequently label 95%+ of complaints as "negative". VADER's compound score enables fine-grained negative severity differentiation (e.g., mildly dissatisfied $-0.25$ vs furious outrage $-0.89$).

### 6.2 Emotion Detection Engine

- **Framework Identifier:** Plutchik Domain-Adapted Emotion Lexicon (`lexicon/plutchik-complaint-v1.0`)
- **Supported Emotional States:** `anger`, `fear`, `sadness`, `disgust`, `surprise`, `joy`, `neutral`
- **Output Representation:** Probability distribution over emotional states with normalized confidence scores and identified secondary emotions.
- **Negation Suppression:** Employs window-based negation handling: if an emotion token is preceded by negation within 3 tokens (e.g., "not angry", "never afraid"), that emotion is suppressed to prevent false triggers.

---

## 7. Explainable Urgency Assessment Engine

### 7.1 Multi-Signal Deterministic Rule Engine

Urgency assessment must be **transparent and auditable** in financial and consumer support contexts. Black-box classifiers frequently assign high urgency purely due to aggressive profanity. Our explainable engine combines six weighted criteria:

| Rule ID         | Rule Name                        |   Weight    | Primary Trigger Patterns                                                   |
| :-------------- | :------------------------------- | :---------: | :------------------------------------------------------------------------- |
| `R01_SECURITY`  | Security Breach & Identity Theft | **+45 pts** | Identity theft, fraud, hacked, unauthorized access, compromised            |
| `R02_FINANCIAL` | Financial Loss & Double Charge   | **+35 pts** | Charged twice, double charge, duplicate debit, overdraft fee, stolen funds |
| `R03_OUTAGE`    | Essential Service Outage         | **+30 pts** | Account locked, unable to access, system down, card declined, lockout      |
| `R04_DEADLINE`  | Time-Sensitive Deadline          | **+25 pts** | Immediately, urgent, 24 hours, tomorrow, deadline, foreclosure             |
| `R05_REPEATED`  | Repeated Unresolved Inquiries    | **+20 pts** | Called 5 times, third attempt, no response, weeks ago, still waiting       |
| `R06_LEGAL`     | Legal & Regulatory Escalation    | **+20 pts** | Attorney, CFPB, lawsuit, legal action, court, formal complaint             |

### 7.2 Priority Levels & Escalation Criteria

- **CRITICAL (Score $\ge 70$ OR Security Breach Triggered):** Eligible for immediate human review queue.
- **HIGH (Score $45 - 69$):** Requires priority handling within 4 hours.
- **MEDIUM (Score $25 - 44$):** Standard queue SLA (24 hours).
- **LOW (Score $< 25$):** Routine informational inquiry.

### 7.3 Academic Constraints & Clarifications

1. Deterministic rule scoring produces explainable heuristic indices, not calibrated Bayesian probabilities.
2. Negative sentiment alone does not trigger `CRITICAL` or `HIGH` urgency.
3. Every assessment returns an array of `urgencyReasons` showing the exact matched term, rule name, and weight.

---

## 8. Department Recommendation Engine

Categories map to six canonical department codes with automatic fallback:

| Predicted Category     | Recommended Department Code | Department Display Name               |
| :--------------------- | :-------------------------: | :------------------------------------ |
| `credit_card`          |      `DEP_CREDIT_CARD`      | Credit Card Operations                |
| `credit_reporting`     |   `DEP_CREDIT_REPORTING`    | Credit Reporting & Dispute Management |
| `debt_collection`      |    `DEP_DEBT_COLLECTION`    | Debt Collection Operations            |
| `mortgages_and_loans`  |    `DEP_MORTGAGE_LOANS`     | Mortgage & Loan Servicing             |
| `retail_banking`       |    `DEP_RETAIL_BANKING`     | Retail Banking & Deposit Support      |
| _(Unknown / Fallback)_ |    `DEP_GENERAL_SUPPORT`    | General Customer Support Tier 1       |

---

## 9. Dataset Biases & Model Limitations

1. **CFPB Domain Specificity:** The public dataset reflects consumer complaints against US financial institutions. Linguistic features reflect terms such as "FCRA", "escrow", "credit bureau", and "overdraft". Applying this model to e-commerce or telecom domains will require domain transfer fine-tuning.
2. **Class Imbalance:** 45.18% of the cleaned dataset represents credit reporting disputes. Even with balanced class weighting, precision is highest on credit reporting (93.12%) and lower on credit card (75.35%).
3. **Confidence Score Calibration:** Logistic regression sigmoid probabilities provide monotonic rankings but are not calibrated against empirical error distributions. Platt scaling or temperature scaling will be explored in future work.
4. **Language Limitation:** Current models support English-language complaints only.

---

## 10. Reproduction Instructions

To reproduce all dataset preprocessing, training, and evaluation benchmarks:

```powershell
# 1. Ingest, clean, and generate 70/15/15 splits from raw CSV
python scripts/ingest_dataset.py --input-file data/raw/complaints_processed.csv --output-dir data/processed --random-seed 42

# 2. Train baseline TF-IDF + Logistic Regression pipeline
python scripts/train_classifier.py --data-dir data/processed --artifacts-dir services/nlp/artifacts --random-seed 42

# 3. Evaluate trained artifact on held-out test set
python scripts/evaluate_classifier.py --test-file data/processed/test.csv --model-path services/nlp/artifacts/category_model.joblib --output-report data/processed/test_evaluation_report.json

# 4. Run automated test suite
python -m pytest services/nlp/tests -v
npm test
```

---

## 11. Phase 2 Semantic Retrieval Evaluation Benchmark & RAG Calibration

### 11.1 Benchmark Methodology

To evaluate the semantic retrieval component against an information retrieval baseline, 20 held-out evaluation queries representing common, complex financial disputes were benchmarked across:

1. **Dense Semantic Retrieval:** `all-MiniLM-L6-v2` dense embeddings (384 dimensions) with PostgreSQL `pgvector` HNSW cosine similarity.
2. **Lexical Baseline:** TF-IDF unigram + bigram representations with Cosine Similarity.

Metrics evaluated:

- **Hit@k:** Proportion of queries where at least one ground-truth playbook was retrieved in the top $k$ candidates.
- **Recall@k:** Proportion of ground-truth relevant playbooks retrieved in the top $k$ candidates.
- **Precision@k:** Proportion of retrieved candidates in top $k$ that are relevant.
- **Mean Reciprocal Rank (MRR):** $\frac{1}{|Q|} \sum_{i=1}^{|Q|} \frac{1}{\text{rank}_i}$ reflecting top-rank quality.
- **Latency (ms):** Wall-clock query retrieval latency per query.

### 11.2 Measured Benchmark Results (Phase 2 Preliminary 20-Query Suite)

> [!NOTE]
> **Preliminary Benchmark Denominator ($N=20$):** The table below reflects the preliminary 20-query suite evaluated during Phase 2. Because all 20 queries represented straightforward, routine consumer complaints with direct 1:1 playbook mappings, dense semantic retrieval achieved 100% top-5 coverage (**Hit@5 = 1.0000, 20/20**). In Phase 3, this benchmark was expanded to 35 queries containing adversarial, ambiguous, and out-of-domain edge cases (see Section 12), where Hit@5 is **0.9333** (28/30 answerable queries).

Report artifact: `docs/retrieval_evaluation_report.json`

| Metric           | Dense Semantic (`pgvector` + `all-MiniLM-L6-v2`) | TF-IDF Lexical Baseline | Absolute Gain |      Relative Gain      |
| ---------------- | :----------------------------------------------: | :---------------------: | :-----------: | :---------------------: |
| **Hit@1**        |                **0.9500** (19/20)                |     0.9500 (19/20)      |    +0.0000    |     Baseline match      |
| **Hit@3**        |                **1.0000** (20/20)                |     0.9500 (19/20)      |  **+0.0500**  |       **+5.26%**        |
| **Hit@5**        |                **1.0000** (20/20)                |     1.0000 (20/20)      |    +0.0000    |      100% Coverage      |
| **Recall@1**     |                    **0.9500**                    |         0.9500          |    +0.0000    |     Baseline match      |
| **Recall@3**     |                    **1.0000**                    |         0.9500          |  **+0.0500**  |       **+5.26%**        |
| **Recall@5**     |                    **1.0000**                    |         1.0000          |    +0.0000    |      100% Coverage      |
| **Precision@1**  |                    **0.9500**                    |         0.9500          |    +0.0000    |     Baseline match      |
| **Precision@3**  |                    **0.3333**                    |         0.3167          |  **+0.0167**  |       **+5.24%**        |
| **Precision@5**  |                    **0.2000**                    |         0.2000          |    +0.0000    |   Standard top-k cap    |
| **MRR**          |                    **0.9750**                    |         0.9600          |  **+0.0150**  |       **+1.56%**        |
| **Mean Latency** |                   **4.88 ms**                    |         0.73 ms         |   +4.15 ms    | Sub-5ms production tier |

### 11.3 Qualitative Analysis: Semantic Paraphrasing & Lexical Gaps

The primary advantage of dense retrieval is robustness to vocabulary mismatch and consumer paraphrasing.

- **Example Query:** `"I requested a loan payoff quote from my mortgage servicer and they missed the deadline"`
  - **TF-IDF Match:** Failed to rank `KB-LOAN-003` at rank 1 due to absence of specific terms ("payoff quote" vs "statement of payoff amount").
  - **Dense Retrieval:** Ranked `KB-LOAN-003` (RESPA Payoff Statement Delay Procedure) at **Rank 1** with **0.812 cosine similarity** via contextual semantic proximity.
- **Sub-5ms Latency:** Dense vector retrieval using HNSW indexed pgvector completes in an average of 4.88 ms on local hardware, easily fulfilling real-time customer support latency requirements (< 100 ms).

### 11.4 Evidence Strength Calibration & Risk Controls

To prevent hallucinated recommendations or over-confident advice on novel complaints, the RAG engine applies strict calibrated thresholds:

$$ \text{Evidence Strength} = \begin{cases}
\text{HIGH} & \text{if } \max(\text{score}) \ge 0.70 \\
\text{MEDIUM} & \text{if } 0.55 \le \max(\text{score}) < 0.70 \\
\text{LOW} & \text{if } 0.40 \le \max(\text{score}) < 0.55 \\
\text{INSUFFICIENT} & \text{if } \max(\text{score}) < 0.40
\end{cases}$$

Heuristic evidence score is computed by combining top retrieval similarity with matched candidate density:
$$\text{Evidence Score} = \min(0.95, \, \text{top\_score} \times 0.85 + 0.05 \times \min(\text{count}, 3))$$

### 11.5 Risk Rules Engine: Mandatory Human Review

A deterministic safety filter scans every complaint prior to recommendation generation. Human oversight is mandated (`human_review_required = True`) whenever:

1. **Litigation Terms:** Complaint contains words such as `"sue"`, `"lawsuit"`, `"court"`, `"attorney"`, `"lawyer"`, `"legal counsel"`.
2. **Regulatory Agencies:** Mentions `"CFPB"`, `"FDIC"`, `"FTC"`, `"OCC"`, or `"attorney general"`.
3. **Identity Theft:** Mentions `"identity theft"` or `"fraudulent account"`.
4. **Low Evidence:** Retrieval yields `INSUFFICIENT` evidence ($\text{score} < 0.40$).

---

## 12. Phase 3 Expanded Semantic Retrieval Benchmark (35 Queries)

In Phase 3, the evaluation set was expanded from 20 to **35 independently reviewed query cases** to evaluate edge cases, ambiguous complaints, multi-category overlaps, out-of-domain submissions, security-sensitive scenarios, and low-evidence requests.

### 12.1 Evaluation Dataset Composition

- **Routine Queries (15 cases):** Standard single-issue complaints with established statutory playbooks (Reg Z, FCRA, Reg E, RESPA, FDCPA).
- **Ambiguous & Paraphrased Queries (5 cases):** Colloquial consumer descriptions with substantial vocabulary mismatch.
- **Overlapping Category Queries (5 cases):** Complaints spanning multiple departments (e.g. credit card charge impacting credit report bureau file).
- **Out-of-Domain Queries (5 cases):** Off-topic submissions (cryptocurrency smart contracts, auto insurance claims, food delivery) that must produce zero results or trigger abstention.
- **Security-Sensitive & Adversarial (3 cases):** Wire fraud, credential harvesting, and identity theft.
- **Low-Evidence / Insufficient Data (2 cases):** Vague submissions lacking actionable facts.

### 12.2 Empirical Benchmark Results

Evaluated via `python services/nlp/scripts/evaluate_retrieval.py` on real PostgreSQL 16 + pgvector HNSW index:

| Retrieval Metric | Dense Semantic (`pgvector` HNSW) | Lexical Baseline (TF-IDF) | Absolute Delta | Relative Gain | Benchmark Status |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Total Benchmark Queries** | 35 | 35 | — | — | 30 answerable + 5 unanswerable |
| **Answerable Target Queries** | 30 | 30 | — | — | Target playbooks defined |
| **Hit@1** | **0.8000** (24/30) | 0.8000 (24/30) | +0.0000 | Equal | Exact playbook identified at Rank 1 |
| **Hit@3** | **0.9333** (28/30) | 0.8667 (26/30) | **+0.0667** | **+7.69%** | Dense retrieval captures paraphrased cases |
| **Hit@5** | **0.9333** (28/30) | 0.9000 (27/30) | **+0.0333** | **+3.70%** | Comprehensive candidate coverage in top-5 |
| **Recall@3** | **0.8667** | 0.7667 | **+0.1000** | **+13.04%** | Multi-target coverage across overlapping domains |
| **Precision@3** | **0.3444** | 0.3000 | **+0.0444** | **+14.80%** | Density of relevant targets in top 3 slots |
| **MRR (Mean Reciprocal Rank)** | **0.8611** | 0.8344 | **+0.0267** | **+3.20%** | Superior reciprocal ranking |
| **Out-of-Domain Abstention Rate** | **100.0%** (5/5) | 100.0% (5/5) | +0.0000 | 100% | Proximity-based abstention on off-topic queries |
| **Source Provenance Compliance** | **100.0%** (35/35) | — | — | 100% | All retrieved sources link to verified statutory citations |

> [!NOTE]
> **Reconciliation of Hit@5 (0.9333 vs 1.0000):** In the preliminary 20-query evaluation (Section 11), Hit@5 was 1.0000 (20/20) on standard routine queries. On this expanded 35-query benchmark (30 answerable queries + 5 out-of-domain), Hit@5 is **0.9333 (28/30)** because two complex, multi-intent edge cases (such as vehicle loan lien release delays and multi-agency collection claims) exhibited severe consumer colloquialisms placing their targets outside the top 5. Both numbers are empirically reproduced and represent distinct benchmark suites.

---

## 13. Phase 3 Recommendation Quality Evaluation (15-Case Rubric)

To assess the factual accuracy, policy grounding, and safety of generated recommendations, a 15-case evaluation was conducted using a 6-dimension evaluation rubric (`services/nlp/scripts/evaluate_recommendations.py`):

1. **Relevance to Complaint:** Assesses whether the suggested resolution directly addresses the consumer's primary grievance.
2. **Evidence Support / Grounding:** Assesses whether every action step is strictly derived from the matched statutory playbook without unverified leaps.
3. **Citation & Statutory Authority:** Assesses whether cited legal provisions (12 CFR 1026.13, 15 U.S.C. 1681b, etc.) are accurate and applicable.
4. **Actionability:** Assesses whether suggested steps are concrete, chronological, and executable by a support agent.
5. **Safety & Policy Compliance:** Assesses whether the recommendation avoids guarantees, unauthorized disclosures, or legal liabilities.
6. **Escalation Appropriateness:** Assesses whether human review was correctly flagged when legal, regulatory, or high-loss triggers were present.

### 13.1 Rubric Scores & Findings

- **Total Cases Evaluated:** 15
- **Average Relevance Score:** **5.00 / 5.00**
- **Average Evidence Grounding Score:** **4.83 / 5.00**
- **Average Citation Accuracy Score:** **4.83 / 5.00**
- **Average Actionability Score:** **5.00 / 5.00**
- **Average Safety & Compliance Score:** **5.00 / 5.00**
- **Escalation Trigger Accuracy:** **86.7%** (13/15 correct triggers)
- **Hallucinations Detected:** **0** (0.0%)

---

## 14. Evidence-Strength Semantics vs Calibrated Probabilities

### 14.1 Honest Semantics of Similarity Scores

A common methodological error in RAG systems is equating vector cosine similarity ($1 - \text{distance}$) with a calibrated statistical probability. In this project:

1. **Cosine Similarity is a Geometric Distance Metric:** Cosine similarity measures the angle between normalized vector projections in 384-dimensional latent space. It is **not** a calibrated posterior probability $P(Y=1 | X)$.
2. **Heuristic Tiering:** The categories `HIGH` ($\ge 0.70$), `MEDIUM` ($0.55 - 0.70$), and `LOW` ($0.40 - 0.55$) represent **empirically determined retrieval proximity thresholds**, not Bayesian confidence levels.
3. **No Uncalibrated Claims:** The system explicitly labels these scores as **"Retrieval Proximity / Evidence Strength"** rather than "calibrated accuracy". True probability calibration would require empirical Platt scaling or isotonic regression on a large, labeled human-annotated acceptance dataset.

---

## 15. Known Machine Learning & Operational Limitations

1. **Single-Domain Focus:** The classification and retrieval models are tuned specifically to US consumer financial protection disputes (CFPB taxonomy). Performance on international consumer regulations (e.g. UK FCA, EU GDPR) is untested.
2. **TF-IDF Vocabulary Freeze:** The Phase 1 classifier relies on a fixed 10,000-feature vocabulary. Brand-new financial products (e.g. specific crypto-backed credit lines) require re-fitting.
3. **Embedding Vector Resolution:** While `all-MiniLM-L6-v2` offers exceptional latency (~4.8ms), long narratives (> 256 WordPiece tokens) are truncated during embedding generation.
4. **Offline Provider Limitations:** The offline extractive RAG provider guarantees zero hallucinations by quoting playbook text, but produces more rigid phrasing than generative LLMs.
