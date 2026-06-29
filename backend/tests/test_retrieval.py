"""Tests for retrieval helpers (pure logic, no model/DB)."""
from app.services.retrieval import reciprocal_rank_fusion


def test_rrf_rewards_agreement():
    # 'b' is high in both rankings -> should rank first after fusion.
    keyword = ["a", "b", "c"]
    vector = ["b", "d", "a"]
    fused = reciprocal_rank_fusion([keyword, vector])
    assert fused[0] == "b"
    assert set(fused) == {"a", "b", "c", "d"}


def test_rrf_single_ranking_preserves_order():
    assert reciprocal_rank_fusion([["x", "y", "z"]]) == ["x", "y", "z"]


def test_rrf_empty():
    assert reciprocal_rank_fusion([]) == []
    assert reciprocal_rank_fusion([[], []]) == []
