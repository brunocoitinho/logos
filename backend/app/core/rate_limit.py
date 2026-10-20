"""Limite de tentativas de login (proteção contra força bruta).

Guarda em memória os horários das falhas por chave (IP + e-mail). Funciona porque a API
roda em um único processo; com várias instâncias, o contador iria para um armazenamento
compartilhado como o Redis.
"""

import time
from collections import defaultdict, deque
from threading import Lock

from app.core.config import get_settings


class LoginRateLimiter:
    def __init__(self, max_failures: int, window_seconds: int) -> None:
        self.max_failures = max_failures
        self.window_seconds = window_seconds
        self._failures: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def retry_after(self, key: str) -> int:
        """Segundos até liberar novas tentativas (0 = liberado)."""
        with self._lock:
            failures = self._recent_failures(key)
            if not failures:
                # Sem falhas recentes: libera a memória da chave.
                del self._failures[key]
                return 0
            if len(failures) < self.max_failures:
                return 0
            return max(1, int(failures[0] + self.window_seconds - time.monotonic()))

    def register_failure(self, key: str) -> None:
        with self._lock:
            self._recent_failures(key).append(time.monotonic())

    def reset(self, key: str | None = None) -> None:
        with self._lock:
            if key is None:
                self._failures.clear()
            else:
                self._failures.pop(key, None)

    def _recent_failures(self, key: str) -> deque[float]:
        failures = self._failures[key]
        cutoff = time.monotonic() - self.window_seconds
        while failures and failures[0] < cutoff:
            failures.popleft()
        return failures


_settings = get_settings()
login_rate_limiter = LoginRateLimiter(_settings.login_max_failures, _settings.login_window_seconds)
