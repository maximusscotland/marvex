"""Tests for the RAG-memory plumbing in /api/research.

We don't call the live LLM here — we only verify:
  1. The request model accepts the optional `memory` list and parses nested
     ResearchMemoryEntry / ResearchMemoryBranch shapes.
  2. `build_memory_blob()` produces a compact text block matching our shape,
     and returns '' for empty memory.
"""
import pytest  # noqa: F401
from server import (
    ResearchRequest,
    ResearchMemoryEntry,
    ResearchMemoryBranch,
    build_memory_blob,
)


def test_research_request_accepts_empty_memory():
    req = ResearchRequest(map_context={"focus_title": "String theory"})
    assert req.memory == []


def test_research_request_parses_memory_entries():
    payload = {
        "map_context": {"focus_title": "String theory"},
        "memory": [
            {
                "focus_title": "Quantum gravity",
                "map_title": "Physics research",
                "branches": [
                    {"title": "AdS/CFT", "children": ["Maldacena", "Holography"]},
                    {"title": "Loop quantum gravity", "children": []},
                ],
            }
        ],
    }
    req = ResearchRequest(**payload)
    assert len(req.memory) == 1
    m = req.memory[0]
    assert isinstance(m, ResearchMemoryEntry)
    assert m.focus_title == "Quantum gravity"
    assert m.branches[0].title == "AdS/CFT"
    assert m.branches[0].children == ["Maldacena", "Holography"]


def test_build_memory_blob_empty_returns_empty_string():
    assert build_memory_blob([]) == ""


def test_build_memory_blob_renders_compact_tree():
    entries = [
        ResearchMemoryEntry(
            focus_title="Quantum gravity",
            map_title="Physics",
            branches=[
                ResearchMemoryBranch(title="AdS/CFT", children=["Maldacena", "Holography"]),
                ResearchMemoryBranch(title="Loop QG", children=[]),
            ],
        )
    ]
    blob = build_memory_blob(entries)
    assert "Prior research on \"Quantum gravity\"" in blob
    assert "(from map \"Physics\")" in blob
    assert "AdS/CFT" in blob
    assert "Maldacena" in blob
    assert "Holography" in blob
    assert "Loop QG" in blob


def test_build_memory_blob_caps_entries_and_branches():
    # 5 entries but we only render 3.
    entries = [
        ResearchMemoryEntry(
            focus_title=f"Topic {i}",
            branches=[
                ResearchMemoryBranch(title=f"B{i}.{j}", children=[f"c{k}" for k in range(10)])
                for j in range(10)
            ],
        )
        for i in range(5)
    ]
    blob = build_memory_blob(entries, max_entries=3)
    # Only 3 top-level entries appear.
    assert blob.count("Prior research on") == 3
    # First entry's branches are capped at 6 (see implementation).
    assert blob.count("B0.") == 6


def test_build_memory_blob_skips_entries_without_focus_title():
    entries = [
        ResearchMemoryEntry(focus_title="", branches=[ResearchMemoryBranch(title="x")]),
        ResearchMemoryEntry(focus_title="Keeper", branches=[ResearchMemoryBranch(title="y")]),
    ]
    blob = build_memory_blob(entries)
    assert "Keeper" in blob
    # The empty-focus entry should be skipped entirely.
    assert blob.count("Prior research on") == 1
