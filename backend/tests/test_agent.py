"""The tool loop must stay bounded and degrade instead of breaking."""
import json
from types import SimpleNamespace

import pytest

from app.services import agent


class _Call:
    def __init__(self, name, arguments, call_id="c1"):
        self.id = call_id
        self.function = SimpleNamespace(name=name, arguments=json.dumps(arguments))


class _FakeGroq:
    """Replays a scripted sequence of model responses and records the requests."""

    def __init__(self, script):
        self.script = list(script)
        self.requests = []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    def _create(self, **kwargs):
        self.requests.append(kwargs)
        if not self.script:
            raise AssertionError("model called more times than the script allows")
        step = self.script.pop(0)
        if isinstance(step, Exception):
            raise step
        return SimpleNamespace(choices=[SimpleNamespace(message=step)])


def message(content=None, tool_calls=None):
    return SimpleNamespace(content=content, tool_calls=tool_calls)


class _Tools:
    def __init__(self, result=None):
        self.calls = []
        self.result = result if result is not None else {"records": []}

    def call(self, name, arguments):
        self.calls.append((name, arguments))
        return self.result


@pytest.fixture
def fake(monkeypatch):
    def install(script):
        client = _FakeGroq(script)
        monkeypatch.setattr(agent, "client", client)
        return client
    return install


def test_a_plain_answer_is_returned_as_is(fake):
    fake([message(content="Paracetamol 650mg, twice a day.")])
    result = agent.answer_with_tools("what was prescribed?", _Tools())
    assert result["answer"] == "Paracetamol 650mg, twice a day."
    assert result["used_tools"] == []


def test_a_tool_result_feeds_the_final_answer(fake):
    client = fake([
        message(tool_calls=[_Call("get_test_history", {"member": "Mom"})]),
        message(content="Her last blood test was on 2 May 2026."),
    ])
    tools = _Tools({"tests": [{"record_id": "r-blood", "date": "2026-05-02", "doctor": "Bhat"}]})

    result = agent.answer_with_tools("when was mom's last blood test?", tools)

    assert tools.calls == [("get_test_history", {"member": "Mom"})]
    assert result["answer"].startswith("Her last blood test")
    assert result["used_tools"] == ["get_test_history"]
    # The tool's output is fed back so the model answers from it.
    tool_message = [m for m in client.requests[1]["messages"] if m["role"] == "tool"][0]
    assert "r-blood" in tool_message["content"]


def test_records_the_tools_surfaced_become_citable_sources(fake):
    fake([
        message(tool_calls=[_Call("search_records", {"query": "knee"})]),
        message(content="Paracetamol was prescribed for the knee."),
    ])
    tools = _Tools({"records": [
        {"record_id": "r-knee", "date": "2026-06-14", "doctor": "Kumar", "member": "Abdul (Father)"},
        {"record_id": "r-knee", "date": "2026-06-14", "doctor": "Kumar"},  # duplicate
    ]})

    sources = agent.answer_with_tools("knee?", tools)["sources"]

    assert [s["record_id"] for s in sources] == ["r-knee"]
    assert sources[0] == {
        "ref": 1, "record_id": "r-knee", "date": "2026-06-14",
        "doctor_name": "Kumar", "member": "Abdul (Father)",
    }


def test_the_loop_gives_up_rather_than_looping_forever(fake):
    """A model that only ever calls tools must not run unbounded."""
    client = fake([message(tool_calls=[_Call("get_timeline", {})]) for _ in range(agent.MAX_ROUNDS)])
    assert agent.answer_with_tools("hello?", _Tools()) is None
    assert len(client.requests) == agent.MAX_ROUNDS


def test_tool_calls_are_capped_within_a_single_question(fake):
    many = [_Call("get_timeline", {}, call_id=f"c{i}") for i in range(agent.MAX_TOOL_CALLS + 4)]
    fake([message(tool_calls=many), message(content="done")])
    tools = _Tools()

    agent.answer_with_tools("everything?", tools)

    assert len(tools.calls) == agent.MAX_TOOL_CALLS


def test_a_model_failure_degrades_instead_of_raising(fake):
    fake([RuntimeError("groq is down")])
    assert agent.answer_with_tools("anything?", _Tools()) is None


def test_an_empty_answer_is_not_passed_off_as_one(fake):
    fake([message(content="   ")])
    assert agent.answer_with_tools("anything?", _Tools()) is None


def test_malformed_tool_arguments_do_not_crash_the_loop(fake):
    broken = _Call("search_records", {})
    broken.function.arguments = "{not json"
    fake([message(tool_calls=[broken]), message(content="Nothing found.")])
    tools = _Tools()

    result = agent.answer_with_tools("?", tools)

    assert tools.calls == [("search_records", {})]
    assert result["answer"] == "Nothing found."


def test_the_model_is_told_to_use_only_the_records(fake):
    fake([message(content="ok")])
    client = agent.client
    agent.answer_with_tools("?", _Tools())
    system = client.requests[0]["messages"][0]
    assert system["role"] == "system"
    assert "Never answer from memory" in system["content"]
    assert "do not advise starting, stopping or changing any treatment" in system["content"]
