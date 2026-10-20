#!/usr/bin/env sh
# Atualiza a produção com o código mais recente do branch atual.
# Uso, na VPS: sh /opt/logos/infra/deploy.sh
set -eu

cd "$(dirname "$0")"

git pull --ff-only
docker compose -f docker-compose.prod.yml up -d --build
# Remove imagens antigas que ficaram sem uso após o build.
docker image prune -f
docker compose -f docker-compose.prod.yml ps
