"""Structured logging configuration for NLP Microservice."""

import logging
import sys


def setup_logging(log_level: str = "INFO") -> logging.Logger:
    """Configures structured console logging for the service."""
    logger = logging.getLogger("complaint_nlp")
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)
    logger.setLevel(numeric_level)

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            fmt="%(asctime)s [%(levelname)s] [%(name)s]: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger


logger = setup_logging()
