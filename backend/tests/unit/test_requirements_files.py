"""requirements.txt y requirements-dev.txt deben decir lo mismo que pyproject.toml."""

import tomllib
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2]


def listed(name: str) -> list[str]:
    lines = (BACKEND / name).read_text(encoding="utf-8").splitlines()
    return [line.strip() for line in lines if line.strip() and not line.startswith(("#", "-r"))]


def test_requirements_match_pyproject() -> None:
    project = tomllib.loads((BACKEND / "pyproject.toml").read_text(encoding="utf-8"))["project"]

    assert listed("requirements.txt") == project["dependencies"]
    assert listed("requirements-dev.txt") == project["optional-dependencies"]["dev"]
