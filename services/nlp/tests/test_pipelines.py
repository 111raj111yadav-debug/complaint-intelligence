"""Unit tests for NLP preprocessing, classification, sentiment, emotion, and urgency pipelines."""


from app.pipelines.classification.classifier import category_classifier
from app.pipelines.emotion.detector import emotion_detector
from app.pipelines.preprocessing.cleaner import (
    normalize_unicode,
    normalize_whitespace,
    preserve_negations,
    strip_html_and_markup,
)
from app.pipelines.preprocessing.pii_redactor import redact_pii
from app.pipelines.preprocessing.preprocessor import default_preprocessor
from app.pipelines.routing.router import department_router
from app.pipelines.sentiment.analyzer import sentiment_analyzer
from app.pipelines.urgency.assessor import urgency_assessor


class TestPreprocessingPipeline:
    def test_unicode_normalization(self):
        # NFKC normalizes full-width characters and ligatures
        raw = "Ｔｅｓｔ ﬃ 123"
        cleaned = normalize_unicode(raw)
        assert cleaned == "Test ffi 123"

    def test_whitespace_normalization(self):
        raw = "  Complaint    text \n\n with \t extra \r spaces.  "
        cleaned = normalize_whitespace(raw)
        assert cleaned == "Complaint text with extra spaces."

    def test_html_stripping(self):
        raw = "<p>My card was <b>blocked</b> &amp; unusable.</p>"
        cleaned = strip_html_and_markup(raw)
        assert "<p>" not in cleaned
        assert "<b>" not in cleaned
        assert "&amp;" not in cleaned
        assert "blocked" in cleaned

    def test_negation_preservation(self):
        raw = "I can't access my account and they won't help."
        cleaned = preserve_negations(raw)
        assert "cannot" in cleaned
        assert "will not" in cleaned

    def test_pii_redaction(self):
        text = (
            "My SSN is 123-45-6789 and my email is customer@example.com. "
            "Call 555-123-4567. Card 4111-2222-3333-4444. Account #12345678."
        )
        redaction = redact_pii(text)
        assert "[REDACTED_SSN]" in redaction.text
        assert "[REDACTED_EMAIL]" in redaction.text
        assert "[REDACTED_PHONE]" in redaction.text
        assert "[REDACTED_CARD]" in redaction.text
        assert "[REDACTED_ACCOUNT]" in redaction.text
        assert redaction.total_redacted >= 5

    def test_empty_and_short_text(self):
        result_empty = default_preprocessor.preprocess("")
        assert result_empty.is_valid is False
        assert "empty" in result_empty.validation_error.lower()

        result_short = default_preprocessor.preprocess("hi")
        assert result_short.is_valid is False
        assert "too short" in result_short.validation_error.lower()


class TestCategoryClassifier:
    def test_model_loaded(self):
        assert category_classifier.is_loaded is True
        assert len(category_classifier.classes_) == 5

    def test_prediction_output_schema(self):
        text = "I opened a dispute regarding an inaccurate inquiry on my credit report."
        pred = category_classifier.predict(text)
        assert pred.status == "success"
        assert pred.category in category_classifier.classes_
        assert 0.0 <= pred.confidence <= 1.0
        assert len(pred.probabilities) == 5
        assert round(sum(pred.probabilities.values()), 2) == 1.0

    def test_empty_input_fallback(self):
        pred = category_classifier.predict("")
        assert pred.status == "empty_input"
        assert pred.confidence == 0.0


class TestSentimentAnalyzer:
    def test_positive_sentiment(self):
        res = sentiment_analyzer.analyze(
            "Thank you very much! The customer support team was fantastic, helpful, and kind."
        )
        assert res.status == "success"
        assert res.label == "positive"
        assert res.compound > 0.05

    def test_negative_sentiment(self):
        res = sentiment_analyzer.analyze(
            "Terrible service! Horrible experience, rude agents, and completely useless."
        )
        assert res.status == "success"
        assert res.label == "negative"
        assert res.compound < -0.05

    def test_neutral_sentiment(self):
        res = sentiment_analyzer.analyze(
            "The transaction occurred on October 12th for the stated amount of 50 dollars."
        )
        assert res.status == "success"
        assert res.label == "neutral"


class TestEmotionDetector:
    def test_anger_detection(self):
        res = emotion_detector.detect(
            "I am furious and outraged! This company is running a scam and harassing me!"
        )
        assert res.status == "success"
        assert res.primary_emotion == "anger"
        assert res.scores["anger"] > res.scores["joy"]

    def test_fear_detection(self):
        res = emotion_detector.detect(
            "I am terrified of losing my home to foreclosure and bankruptcy. Please help!"
        )
        assert res.status == "success"
        assert res.primary_emotion == "fear"
        assert res.scores["fear"] > res.scores["joy"]

    def test_negation_handling(self):
        res = emotion_detector.detect(
            "I am not angry, but I need clarification regarding the invoice."
        )
        assert res.status == "success"
        assert res.scores["anger"] < 0.5


class TestUrgencyAssessor:
    def test_routine_complaint_low_urgency(self):
        res = urgency_assessor.assess(
            "Please update my mailing address for future monthly statements."
        )
        assert res.urgency_level == "LOW"
        assert res.urgency_score < 25
        assert res.human_review_required is False
        assert len(res.contributing_reasons) == 0

    def test_financial_loss_and_deadline(self):
        res = urgency_assessor.assess(
            "My payment was deducted twice and I need this resolved immediately before tomorrow!"
        )
        assert res.urgency_level in ("HIGH", "CRITICAL")
        assert res.urgency_score >= 50
        rule_ids = [r.rule_id for r in res.contributing_reasons]
        assert "FINANCIAL_LOSS_DUPLICATE_CHARGE" in rule_ids
        assert "TIME_SENSITIVE_DEADLINE" in rule_ids

    def test_security_breach_flags_human_review(self):
        res = urgency_assessor.assess(
            "My identity was stolen and someone gained unauthorized access to my accounts!"
        )
        assert res.human_review_required is True
        rule_ids = [r.rule_id for r in res.contributing_reasons]
        assert "SECURITY_SAFETY_BREACH" in rule_ids

    def test_angry_words_alone_do_not_escalate_urgency(self):
        res = urgency_assessor.assess("I am very angry and mad and this is terrible service.")
        # Emotional language without operational risk should remain LOW urgency
        assert res.urgency_level == "LOW"
        assert res.human_review_required is False


class TestDepartmentRouter:
    def test_known_category_routing(self):
        rec_credit = department_router.recommend("credit_reporting")
        assert rec_credit.department_code == "DEPT_CREDIT"
        assert rec_credit.is_fallback is False

        rec_cards = department_router.recommend("credit_card")
        assert rec_cards.department_code == "DEPT_CARDS"
        assert rec_cards.is_fallback is False

    def test_unknown_category_fallback(self):
        rec_unknown = department_router.recommend("unsupported_category_xyz")
        assert rec_unknown.department_code == "DEPT_GENERAL"
        assert rec_unknown.is_fallback is True
