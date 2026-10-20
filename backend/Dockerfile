FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Dependências antes do código: mudar o código não reinstala as bibliotecas (cache de camadas).
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY alembic.ini .
COPY alembic ./alembic
COPY app ./app
COPY scripts ./scripts

# A aplicação não roda como root dentro do container.
RUN useradd --create-home --uid 10001 appuser
USER appuser

EXPOSE 8000

# 1. Aplica as migrações pendentes (idempotente: sem pendências, não faz nada).
# 2. Sobe a API com um único processo: o limite de tentativas de login fica em memória.
# --proxy-headers: o IP real do cliente vem do Caddy (X-Forwarded-For); sem isso, todos os
# acessos teriam o IP do Caddy e o limite de login bloquearia todo mundo junto.
# --forwarded-allow-ips='*' é seguro aqui porque a API não publica porta: só o Caddy, na
# rede interna do Docker, consegue falar com ela.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]
