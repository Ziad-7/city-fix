"""Backend tests.

Runs before conftest: the app builds its engine at import time, so point it at a throwaway DB
(never the dev DB) and keep startup seeding off. Tests inject their own session via dependency_overrides.
"""

import os
import tempfile

_TMP = tempfile.mkdtemp(prefix="ftc-tests-")
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP}/app.db"
os.environ["SEED_ON_START"] = "false"
os.environ.setdefault("JWT_SECRET", "test-secret-test-secret-test-secret!!")
