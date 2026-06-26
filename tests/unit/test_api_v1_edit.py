# -*- coding: utf-8 -*-
# SPDX-License-Identifier: GPL-3.0-or-later
"""Unit tests for /api/v1 edit-metadata — role gating, result parsing, and the
per-field dispatch to the shared edit_book_param core (mocked)."""
import inspect
import json
import flask
import pytest
from types import SimpleNamespace
from unittest.mock import patch, MagicMock


def _ctx(path, method="POST", body=None):
    app = flask.Flask(__name__)
    app.config["WTF_CSRF_ENABLED"] = False
    kwargs = {"method": method}
    if body is not None:
        kwargs["json"] = body
        kwargs["content_type"] = "application/json"
    return app.test_request_context(path, **kwargs)


def _editor(role_edit=True, anon=False):
    return SimpleNamespace(is_authenticated=True, is_anonymous=anon,
                           role_edit=lambda: role_edit, id=1)


# ── result parsing ───────────────────────────────────────────────────────────

@pytest.mark.unit
def test_parse_edit_result_success_response():
    from cps.api import edit as mod
    resp = flask.Response(json.dumps({"success": True, "newValue": "X"}), mimetype="application/json")
    assert mod._parse_edit_result(resp) == (True, "")


@pytest.mark.unit
def test_parse_edit_result_failure_response():
    from cps.api import edit as mod
    resp = flask.Response(json.dumps({"success": False, "msg": "bad lang"}), mimetype="application/json")
    ok, msg = mod._parse_edit_result(resp)
    assert ok is False and msg == "bad lang"


@pytest.mark.unit
def test_parse_edit_result_tuple_is_error():
    from cps.api import edit as mod
    ok, msg = mod._parse_edit_result(("Parameter not found", 400))
    assert ok is False and "Parameter" in msg


@pytest.mark.unit
def test_parse_edit_result_empty_is_success():
    from cps.api import edit as mod
    assert mod._parse_edit_result("") == (True, "")


# ── role gating ──────────────────────────────────────────────────────────────

@pytest.mark.unit
def test_get_metadata_requires_edit_role():
    from cps.api import edit as mod
    with _ctx("/api/v1/books/5/metadata", method="GET"):
        with patch.object(mod, "current_user", _editor(role_edit=False)):
            resp = inspect.unwrap(mod.get_metadata)(5)
    assert resp[1] == 403


@pytest.mark.unit
def test_update_metadata_anonymous_401():
    from cps.api import edit as mod
    with _ctx("/api/v1/books/5/metadata", body={"title": "X"}):
        with patch.object(mod, "current_user", _editor(anon=True)):
            resp = inspect.unwrap(mod.update_metadata)(5)
    assert resp[1] == 401


# ── dispatch ─────────────────────────────────────────────────────────────────

@pytest.mark.unit
def test_update_metadata_calls_core_per_field():
    from cps.api import edit as mod
    fake_book = SimpleNamespace(
        id=5, title="T", authors=[], series=[], series_index=1.0,
        tags=[], publishers=[], languages=[], comments=[], ratings=[],
    )
    success = flask.Response(json.dumps({"success": True}), mimetype="application/json")
    with _ctx("/api/v1/books/5/metadata", body={"title": "New Title", "tags": "a, b"}):
        with patch.object(mod, "current_user", _editor()), \
             patch.object(mod, "calibre_db", SimpleNamespace(get_book=lambda _id: fake_book)), \
             patch.object(mod, "edit_book_param", return_value=success) as core, \
             patch.object(mod, "get_locale", return_value="en"):
            resp = inspect.unwrap(mod.update_metadata)(5)
    # core called once per supplied field (title, tags) — not for absent fields
    called_params = [c.args[0] for c in core.call_args_list]
    assert called_params == ["title", "tags"]
    # each call carries the book pk + the value
    for c in core.call_args_list:
        assert c.args[1]["pk"] == "5"
    assert resp.status_code == 200


@pytest.mark.unit
def test_update_metadata_collects_field_errors():
    from cps.api import edit as mod
    fake_book = SimpleNamespace(
        id=5, title="T", authors=[], series=[], series_index=1.0,
        tags=[], publishers=[], languages=[], comments=[], ratings=[],
    )
    fail = flask.Response(json.dumps({"success": False, "msg": "Invalid languages"}),
                          mimetype="application/json")
    with _ctx("/api/v1/books/5/metadata", body={"languages": "zz"}):
        with patch.object(mod, "current_user", _editor()), \
             patch.object(mod, "calibre_db", SimpleNamespace(get_book=lambda _id: fake_book)), \
             patch.object(mod, "edit_book_param", return_value=fail), \
             patch.object(mod, "get_locale", return_value="en"):
            resp = inspect.unwrap(mod.update_metadata)(5)
    body = json.loads(resp.get_data())
    assert body["errors"]["languages"] == "Invalid languages"
