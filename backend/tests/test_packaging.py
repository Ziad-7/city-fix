"""Vercel installs from uv.lock, so runtime deps must live in pyproject, not only requirements.txt."""

import re
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _name(spec: str) -> str:
    return re.split(r"[\[<>=!~;\s]", spec.strip(), maxsplit=1)[0].lower().replace("_", "-")


def test_requirements_match_pyproject_runtime_dependencies():
    lines = (ROOT / "requirements.txt").read_text().splitlines()
    req = {_name(line) for line in lines if line.strip() and not line.lstrip().startswith("#")}
    project = tomllib.loads((ROOT / "pyproject.toml").read_text())["project"]
    assert req == {_name(dep) for dep in project["dependencies"]}


def test_lockfile_has_ortools_as_runtime_dependency():
    lock = tomllib.loads((ROOT / "uv.lock").read_text())
    package = next(p for p in lock["package"] if p["name"] == "fixthecity-backend")
    assert "ortools" in {dep["name"] for dep in package["dependencies"]}
