"""Count SQL statements sent through an engine (N+1 regression guard)."""

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import event
from sqlalchemy.engine import Engine


@contextmanager
def count_queries(engine: Engine) -> Iterator[list[str]]:
    seen: list[str] = []

    def on_execute(conn, cursor, statement, parameters, context, executemany):  # type: ignore[no-untyped-def]
        seen.append(statement)

    event.listen(engine, "before_cursor_execute", on_execute)
    try:
        yield seen
    finally:
        event.remove(engine, "before_cursor_execute", on_execute)
