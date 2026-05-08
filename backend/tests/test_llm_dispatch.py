"""LLM dispatch tests — provider normalisation contract.

These lock in the BYOK provider-routing contract so future refactors can't
silently regress. LLMGateway support was removed Feb 2026 — only native
providers remain (Anthropic / OpenAI / Gemini).
"""

import pytest

import server as srv


def test_normalize_provider_known():
    assert srv.normalize_provider("anthropic") == "anthropic"
    assert srv.normalize_provider("openai") == "openai"
    assert srv.normalize_provider("gemini") == "gemini"


def test_normalize_provider_unknown_falls_back_to_anthropic():
    assert srv.normalize_provider(None) == "anthropic"
    assert srv.normalize_provider("") == "anthropic"
    assert srv.normalize_provider("grok") == "anthropic"
    assert srv.normalize_provider("llmgateway") == "anthropic"  # Removed — falls back
    assert srv.normalize_provider("garbage") == "anthropic"


def test_normalize_provider_case_insensitive():
    assert srv.normalize_provider("ANTHROPIC") == "anthropic"
    assert srv.normalize_provider("OpenAI") == "openai"


def test_native_model_table_complete():
    """Every VALID_PROVIDERS entry must have a model mapping."""
    for p in srv.VALID_PROVIDERS:
        assert p in srv._NATIVE_MODELS, f"Missing model for {p}"
        provider_pkg, model = srv._NATIVE_MODELS[p]
        assert provider_pkg in {"anthropic", "openai", "gemini"}
        assert model  # non-empty
