# Progresso — Logos MVP

> Documento vivo. Atualizado ao fim de cada etapa.
> Referência de requisitos e decisões: [`PRD.md`](./PRD.md). IDs de teste (C1, FE6, ...) estão na matriz do PRD §8.2.
>
> **Prazo: 21/10/2026 às 23h59 · Meta interna: 22h00.** Se atrasar, seguir a ordem de corte do PRD §10.1.

## Combinados de trabalho

- Uma etapa por vez; parar ao fim de cada etapa para revisão.
- **Commits feitos pelo Bruno.** Ao fim de cada etapa: explicar o que foi feito e sugerir a mensagem de commit.
- Commits pequenos, no padrão Conventional Commits: prefixo em inglês (`feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `ci`) e **descrição em português**, no presente ("adiciona", "corrige", "cobre").
- **Testes na mesma etapa da funcionalidade.** Uma etapa só é concluída com os testes dela passando.
- Tecnologia nova (ex.: TanStack Query, MSW, Playwright) é explicada e justificada na documentação antes de usar.
- Perguntar antes quando houver ambiguidade.

## Fluxo de branches

```
main      ← só recebe PR de env/dev (releases); é o que está no ar e o que é entregue
env/dev   ← integração; recebe PRs das features
feat/*, test/*, chore/*, docs/*  ← um branch por etapa, criado a partir de env/dev
```

- Commit inicial na `main`; `env/dev` nasce dela.
- Merge dos PRs com **"Create a merge commit"**, e nunca squash, para preservar os commits pequenos no histórico.
- Cada PR leva uma descrição curta: o que muda e como testar.
- Release 1 (dev → main): API no ar (fim da Etapa 8). Release 2 (dev → main): entrega final (até 22h de 21/10).

| Etapas | Branch | Destino |
|---|---|---|
| 0 | `main` (commit inicial) | — |
| 1 | `feat/backend-scaffold` | env/dev |
| 2–3 | `feat/database-models` | env/dev |
| 4 | `feat/incidents-crud` | env/dev |
| 5 | `feat/auth` | env/dev |
| 6–7 | `feat/incident-lifecycle` | env/dev |
| 8 | `chore/deploy-api` | env/dev → **PR release para main** |
| 9–10 | `feat/frontend-scaffold` | env/dev |
| 11 | `feat/incidents-dashboard` | env/dev |
| 12–13 | `feat/incident-actions` | env/dev |
| 14 | `test/e2e` | env/dev |
| 15 | `chore/deploy-frontend-ci` | env/dev |
| 16 | `docs/readme` | env/dev → **PR release final para main** |

## Registro de decisões

| # | Data | Decisão | Motivo |
|---|---|---|---|
| D1 | 20/10/2026 | Backend em **FastAPI** | Exigência de Python; validação Pydantic e Swagger nativos; estudado na EBAC |
| D2 | 20/10/2026 | Banco **MySQL 8** | Experiência profissional do Bruno; funciona bem com SQLAlchemy |
| D3 | 20/10/2026 | Auth **JWT + 3 analistas demo** | A concorrência precisa saber quem é o analista; cobre "segurança básica" |
| D4 | 20/10/2026 | Estado de servidor com **TanStack Query** | Retry, cache, polling e rollback prontos (PRD §6) |
| D5 | 20/10/2026 | API + MySQL na **VPS Hostinger** (Docker + Caddy), front na **Vercel** | Sem cold start; demonstra infraestrutura; HTTPS automático |
| D6 | 20/10/2026 | Subdomínio `logos-api.startbc.online` (domínio já existente) | HTTPS válido exige domínio; subdomínio propaga mais rápido que domínio novo |
| D7 | 20/10/2026 | Polling (5–10 s) em vez de WebSocket | Suficiente para o MVP, mais simples e resiliente |
| D8 | 20/10/2026 | Concorrência: claim atômico + optimistic locking (`version`) | Não trava linhas; o conflito vira um 409 explicável |
| D9 | 20/10/2026 | Testes do backend contra **MySQL real** (Docker), não SQLite | Atomicidade e enums só são provados no banco real |
| D10 | 20/10/2026 | **MSW** no front, **Playwright** para E2E | Simular falhas de rede de verdade; testar dois analistas simultâneos (PRD §8.4) |
| D11 | 20/10/2026 | Meta de cobertura ≥ 90% em services/api e hooks | Mesmo critério usado no trabalho |
| D12 | 20/10/2026 | Fluxo `feature → env/dev → main` com PRs e merge commit (sem squash) | Mostra o processo de construção; preserva o histórico granular |

---

## Dia 1 (20/10, tarde e noite) — Backend e infraestrutura

### Etapa 0 — Preparação (fazer primeiro)

Status: pendente

**VPS (Ubuntu 26.04 LTS, KVM 2). ⚠️ Expira em 02/11/2026: decidir sobre a renovação.**

- [x] Domínio: usar o já existente `startbc.online` (dispensa registrar domínio novo)
- [x] Registro DNS `A` `logos-api` → IP da VPS, TTL 300 (hPanel → Domínios → startbc.online → DNS)
- [x] Propagação confirmada em 20/10/2026 (Google 8.8.8.8, Cloudflare 1.1.1.1 e nameserver da Hostinger)
- [ ] Confirmar o e-mail de verificação do titular do domínio (evita suspensão)
- [x] Acesso SSH: `ssh vps-vacinas` (atalho no `~/.ssh/config`, chave `id_ed25519_nova`)
- [x] Docker verificado em 20/10/2026: **Docker 29.7.2 + Compose v5.5.0** já instalados
- [x] Nenhum container rodando; **portas 80/443 livres** (Caddy pode usá-las)

- [ ] Criar usuário não-root no grupo `docker`, login por chave SSH
- [x] Firewall `ufw` ativo: OpenSSH, 80/tcp e 443/tcp liberados (IPv4 e IPv6)
- [ ] Conferir o firewall do hPanel (VPS → Segurança → Firewall), se ativo, com as mesmas portas
- [ ] `apt update && apt upgrade -y` (19 atualizações pendentes; fazer antes da Etapa 8, pode pedir reboot)
- [x] `git init` local
- [ ] Renomear o branch para `main`, commit inicial, criar o repo público no GitHub e push
- [ ] Criar `env/dev` a partir da `main` e publicar
- [ ] Criar `feat/backend-scaffold` a partir de `env/dev`
- [x] `.gitignore`, `README.md` inicial, `PRD.md`, `progress.md`

Commit sugerido:

```bash
git add .
git commit -m "docs: adiciona PRD e acompanhamento de progresso do MVP Logos"
```

### Etapa 1 — Esqueleto do backend

Status: **concluída** (20/10/2026) · Branch: `feat/backend-scaffold`

- [x] `backend/` com `pyproject.toml` (config do Ruff e do pytest), `requirements.txt` e `requirements-dev.txt` com versões fixas, `.venv` local
- [x] `core/config.py` com pydantic-settings e `.env.example`
- [x] Rota `GET /api/health` + teste
- [x] `docker-compose.yml` na raiz com MySQL 8.4 na porta **3307** (a 3306 já é usada pelo MySQL local) e criação automática do banco `logos_test`
- [x] `.gitattributes` forçando LF (scripts com CRLF quebram em containers Linux)

Decisões desta etapa:

- Dependências via `requirements*.txt`, e não como pacote instalável: mais simples de explicar e de usar no Dockerfile. O `pyproject.toml` guarda só a configuração das ferramentas.
- `create_app()` (factory) em `main.py`: facilita criar a app com configurações diferentes nos testes.
- Dependências do FastAPI com `Annotated` (`app/api/deps.py`), o padrão recomendado atual (o Ruff acusa `Depends()` como valor padrão de argumento).
- `httpx2` no lugar de `httpx`: o Starlette atual marca o `httpx` como obsoleto no TestClient.
- A API roda fora do Docker em desenvolvimento (reload rápido); o compose local sobe só o MySQL.

Verificação:

- `ruff check` e `ruff format --check`: sem erros.
- `pytest`: 1 passou, sem avisos.
- API rodando: `GET /api/health` → 200 `{"status":"ok","environment":"development"}`; `/docs` → 200.
- CORS: origem `http://localhost:5173` liberada; origem desconhecida recusada (400 no preflight).
- `docker compose config`: válido. (Subida do MySQL será verificada na Etapa 2, com o Docker Desktop ligado.)

Commits sugeridos:

```bash
git add .gitattributes
git commit -m "chore: normaliza finais de linha para LF com .gitattributes"

git add backend/
git commit -m "chore(backend): cria estrutura do projeto FastAPI com configurações e health check"

git add docker-compose.yml infra/
git commit -m "chore: adiciona docker compose com MySQL para desenvolvimento local"

git add progress.md
git commit -m "docs: registra conclusão da etapa 1 e convenção de commits em português"
```

### Etapa 2 — Banco, modelos, migrações e infraestrutura de testes

Status: **concluída** (20/10/2026) · Branch: `feat/database-models`

- [x] Engine/sessão SQLAlchemy (`pool_pre_ping`, `pool_recycle`, timeouts de conexão/leitura/escrita)
- [x] Models `User`, `Incident` (com `version_id_col`), `IncidentEvent`
- [x] Enums de categoria, criticidade, status e tipo de evento (`StrEnum`, gravados como ENUM nativo do MySQL)
- [x] Alembic + migração inicial com índices; upgrade → downgrade → upgrade testado
- [x] pytest + `conftest.py`: banco `logos_test` recriado pelas **migrações reais**, limpeza após cada teste, factories de analista e incidente
- [x] `pytest-cov` configurado
- [ ] Fixture de token JWT → movida para a Etapa 5 (depende da autenticação)

Decisões desta etapa:

- **Datas em UTC com microssegundos** (`DATETIME(6)`): eventos no mesmo segundo ficam em ordem.
- **Nomes de índices e constraints padronizados** (`naming_convention`): as migrações geram os mesmos nomes em qualquer ambiente.
- **Testes rodam as migrações**, e não `create_all`: garantem que o esquema testado é o mesmo de produção.
- **Limpeza com DELETE após cada teste**, e não rollback: os testes de concorrência usam várias conexões, que só enxergam dados confirmados.
- A URL do banco do Alembic vem de `DATABASE_URL` (sem credencial duplicada no `alembic.ini`).
- Migrações geradas passam pelo Ruff automaticamente (hook `module`, portável entre Windows e Linux).

Problema encontrado e corrigido:

- O downgrade autogerado falhava no MySQL (erro 1553: índice que sustenta chave estrangeira não pode ser removido antes dela). Corrigido removendo as tabelas diretamente. O teste de ida e volta da migração serviu justamente para pegar isso.

Verificação:

- `ruff check` e `ruff format --check`: sem erros.
- `pytest --cov`: **7 passaram**, cobertura 97% (só falta o `get_db`, usado a partir da Etapa 4).
- Destaque: `test_stale_write_is_rejected` comprova no MySQL real que, quando dois analistas editam o mesmo incidente, a segunda gravação (com versão antiga) é recusada. É a base do 409 da Etapa 6.
- O banco de desenvolvimento (`logos`) não é tocado pelos testes.

Commits sugeridos (um comando por linha no terminal):

```bash
git add backend/app/db backend/app/models backend/requirements.txt && git commit -m "feat(backend): adiciona sessão do banco e models SQLAlchemy"

git add backend/alembic.ini backend/alembic && git commit -m "feat(backend): adiciona migração inicial do Alembic para usuários e incidentes"

git add backend/tests backend/requirements-dev.txt backend/pyproject.toml && git commit -m "test(backend): configura pytest com banco MySQL de teste isolado e fixtures"

git add progress.md && git commit -m "docs: registra conclusão da etapa 2"
```

### Etapa 3 — Seed e simulador

Status: **concluída** (20/10/2026) · Branch: `feat/database-models`

- [x] `scripts/fake_data.py`: gerador de incidentes realistas (20 trechos de rodovias reais, placas Mercosul, títulos/descrições por categoria, criticidade proporcional à categoria). Reaproveitável pelo simulador.
- [x] `scripts/seed.py`: 3 analistas demo + 100 incidentes com histórico coerente (abertos sem responsável; em investigação com claim; fechados/inconclusivos com nota de resolução)
- [x] `app/core/security.py`: hash bcrypt de senha (adiantado da Etapa 5; o seed precisa gravar senhas reais)
- [x] Relacionamento `Incident.events` ↔ `IncidentEvent.incident` (sem mudança no esquema, sem migração)
- [ ] `scripts/simulate_trucks.py` → **movido para a Etapa 5**: vai enviar incidentes pela API, que só existe depois do CRUD e da autenticação

Credenciais demo: `ana@logos.demo`, `bruno@logos.demo`, `carla@logos.demo`, senha `logos2026`.

Decisões desta etapa:

- **Analistas mantidos, incidentes recriados** a cada execução: dá para rodar o seed de novo antes da demo sem duplicar usuários.
- **Seed bloqueado em produção** sem `--allow-production`, para não apagar dados reais por engano.
- **Gerador recebe `random.Random`**: os testes usam semente fixa e geram sempre os mesmos dados.

Verificação:

- `pytest --cov`: **15 passaram**, cobertura 95% (só o `main()` da linha de comando fica de fora, verificado manualmente).
- `python -m scripts.seed` no banco de dev: 57 abertos (nenhum com responsável), 22 em investigação, 16 fechados e 5 inconclusivos (todos com responsável), 164 eventos. Acentos gravados corretamente em UTF-8.

Commits sugeridos (um comando por linha):

```bash
git add backend/app/core/security.py backend/requirements.txt backend/tests/test_security.py && git commit -m "feat(backend): adiciona hash de senha com bcrypt"

git add backend/app/models && git commit -m "feat(backend): relaciona incidentes ao seu histórico de eventos"

git add backend/scripts backend/tests/test_seed.py backend/pyproject.toml && git commit -m "feat(backend): adiciona seed com analistas demo e 100 incidentes realistas"

git add progress.md && git commit -m "docs: registra conclusão da etapa 3"
```

### Etapa 4 — CRUD, filtros e validação

Status: **concluída** (20/10/2026) · Branch: `feat/incidents-crud`

- [x] Schemas Pydantic de entrada e saída (validação estrita, `extra="forbid"`, normalização de placa/rodovia/UF, datas convertidas para UTC)
- [x] `GET /api/incidents` com filtros múltiplos, busca, paginação e ordenação por prioridade feita no banco
- [x] `GET /api/incidents/summary`
- [x] `GET/POST/PATCH/DELETE` (soft delete); PATCH e DELETE exigem `version`
- [x] Handler de erros com formato padronizado (validação, 404/405, conflito e 500 sem detalhes internos)
- [x] **Testes:** V1–V4 · F1–F5 · **C2 e C5 adiantados da Etapa 6** (PATCH/DELETE já exigem versão)

Decisões desta etapa:

- **Filtros como modelo Pydantic na query string:** parâmetro desconhecido (ex.: `?statuz=`) gera 422 em vez de ser ignorado em silêncio.
- **Filtro padrão = Aberto + Em Investigação** (gestão por exceção). Fechados só aparecem quando pedidos.
- **Ordenação por prioridade com `CASE` no SQL**, e não em Python: funciona com paginação e escala com o volume.
- **PATCH não muda status:** status só muda pelas ações de ciclo de vida (Etapa 6), que têm regras próprias. Campos desconhecidos como `status` ou `assigned_to_id` são recusados.
- **Duas barreiras de concorrência:** (1) a versão enviada pelo cliente é comparada com a atual; (2) se outra gravação ocorrer entre a leitura e o commit, o `StaleDataError` vira 409. As duas devolvem o estado atual em `error.details.current`, para o front atualizar a tela sem nova requisição.
- **Busca com `autoescape`:** `%` e `_` digitados são texto, não curinga.
- **Placa:** aceita o formato antigo (ABC1234) e o Mercosul (ABC1D23), com hífen ou espaço.

Verificação:

- `ruff check` / `ruff format`: sem erros.
- `pytest --cov`: **95 passaram**, cobertura **98%**.
- API rodando contra o banco de dev com o seed: os 5 primeiros da lista são Aberto + Alta + Acidente com Vítimas, do mais antigo para o mais recente; o summary bate com o seed; os erros saem no formato padrão.

Commits sugeridos (um comando por linha, a partir da raiz):

```bash
git add backend/app/core/errors.py backend/app/schemas/errors.py && git commit -m "feat(backend): padroniza respostas de erro com handlers globais de exceção"

git add backend/app/schemas/incident.py && git commit -m "feat(backend): adiciona schemas de incidente com validação estrita"

git add backend/app/services backend/app/api backend/app/main.py && git commit -m "feat(backend): implementa CRUD de incidentes com ordenação por prioridade, filtros e resumo"

git add backend/tests && git commit -m "test(backend): cobre validação, filtros, ordem de prioridade e conflitos de versão"

git add progress.md PRD.md README.md && git commit -m "docs: registra conclusão da etapa 4"
```

### Etapa 5 — Autenticação

Status: **concluída** (20/10/2026) · Branch: `feat/auth`

- [x] Hash bcrypt (adiantado na Etapa 3); custo configurável (12 em produção, 4 nos testes)
- [x] Emissão e validação de JWT (HS256, 8 h = um turno); segredo obrigatório (32+ caracteres) em produção
- [x] `POST /api/auth/login` (com rate limit) e `GET /api/auth/me`
- [x] Rotas de incidentes protegidas; eventos gravam o analista que agiu
- [x] CORS configurado por variável de ambiente (já existia desde a Etapa 1; agora testado)
- [x] Fixtures de teste: `client` autenticado por padrão e `anonymous_client`
- [x] `scripts/simulate_trucks.py` (vindo da Etapa 3) + conta "Telemetria da Frota" no seed
- [x] **Testes:** S1–S4

Decisões desta etapa:

- **Login com JSON + token Bearer.** O Swagger ganhou o botão "Authorize".
- **Login inválido sem pistas:** mesma mensagem e mesmo tempo de resposta para e-mail inexistente e senha errada (bcrypt roda contra um hash fictício).
- **Rate limit próprio em memória** (5 falhas em 5 min por IP + e-mail → 429 com `Retry-After`), no lugar do `slowapi`: poucas linhas, sem dependência, fácil de explicar. Limitação registrada: com várias instâncias da API, o contador iria para o Redis. Durante o bloqueio, nem a senha certa passa.
- **Token de usuário removido é recusado:** a cada requisição, o usuário do token é buscado no banco.
- **Simulador como conta própria** ("Telemetria da Frota"): no histórico, o incidente aparece como enviado pela telemetria, e não por um analista. O seed também passou a registrar a criação em nome dela.
- **Simulador resiliente:** API fora do ar → tenta de novo; token expirado → novo login; credencial recusada → para (em vez de entrar em loop).

Problema encontrado e corrigido:

- O simulador demorava ~2,5 s por envio. Causa: no Windows, `localhost` tenta IPv6 primeiro e espera ~2 s antes de cair para o IPv4 do uvicorn (medido: 2,04 s contra 0,00 s com `127.0.0.1`). O padrão do simulador passou a ser `http://127.0.0.1:8000`.

Verificação:

- `pytest --cov`: **134 passaram**, cobertura 95% (o que falta é o cliente HTTP real do simulador e o `main()` dos scripts, verificados manualmente).
- Ponta a ponta com a API rodando: simulador criou 3 incidentes; com senha errada, parou com mensagem e código de saída 1; sem token → 401 com `WWW-Authenticate: Bearer`; 6ª tentativa de login errada → 429 com `Retry-After: 298`.

Credenciais da telemetria: `frota@logos.demo` / `logos2026`.

Commits sugeridos (um comando por linha, a partir da raiz):

```bash
git add backend/app/core/config.py backend/app/core/security.py backend/app/core/errors.py backend/requirements.txt && git commit -m "feat(backend): adiciona emissão e validação de tokens JWT"

git add backend/app/core/rate_limit.py backend/app/schemas/auth.py backend/app/services/auth.py backend/app/api backend/app/main.py backend/tests/conftest.py backend/tests/factories.py && git commit -m "feat(backend): adiciona login com limite de tentativas e protege as rotas de incidentes"

git add backend/scripts backend/tests/test_seed.py backend/tests/test_simulator.py && git commit -m "feat(backend): adiciona conta da telemetria e simulador de caminhões"

git add backend/tests/test_auth.py && git commit -m "test(backend): cobre autenticação, limite de tentativas e CORS"

git add progress.md PRD.md && git commit -m "docs: registra conclusão da etapa 5"
```

### Etapa 6 — Ciclo de vida, concorrência e resiliência (núcleo do case)

Status: pendente

- [ ] Serviço de transições (máquina de estados do PRD §4.2)
- [ ] `claim` atômico, `release`, `transition` com `version`
- [ ] 409 com estado atual e nome de quem agiu
- [ ] Registro em `incident_events` + `GET /api/incidents/{id}/events`
- [ ] `Idempotency-Key` no POST
- [ ] Retry com backoff (`tenacity`) em falha transitória; 503 quando o banco está fora
- [ ] **Testes de concorrência:** C1 (10 threads → 1 vencedor) · C3, C4, C6 (C2 e C5 já feitos na Etapa 4)
- [ ] **Testes de ciclo de vida:** L1 (transições válidas) · L2 (todas as inválidas, geradas automaticamente) · L3
- [ ] **Testes de resiliência:** R1–R3

Commits sugeridos:

```bash
git commit -m "feat(backend): adiciona máquina de estados do status do incidente"
git commit -m "test(backend): cobre transições de status válidas e inválidas"
git commit -m "feat(backend): implementa claim atômico e optimistic locking com conflito 409"
git commit -m "test(backend): comprova que claims simultâneos têm um único vencedor"
git commit -m "feat(backend): registra histórico de eventos do incidente"
git commit -m "feat(backend): suporta chave de idempotência na criação de incidentes"
git commit -m "feat(backend): repete falhas transitórias do banco e retorna 503 quando indisponível"
git commit -m "test(backend): cobre queda do banco e recuperação de falhas transitórias"
```

### Etapa 7 — Cobertura e robustez extra

Status: pendente

- [ ] Relatório de cobertura; completar até ≥ 90% em `services/` e `api/`
- [ ] *(diferencial, se houver tempo)* V5: Schemathesis contra o OpenAPI, sem nenhuma resposta 500

Commits sugeridos:

```bash
git commit -m "test(backend): eleva a cobertura de services e rotas acima de 90%"
git commit -m "test(backend): adiciona testes baseados em propriedades com Schemathesis"
```

### Etapa 8 — Deploy da API na VPS (walking skeleton)

Status: pendente

- [ ] `backend/Dockerfile`
- [ ] `infra/docker-compose.prod.yml` (api + mysql + caddy; MySQL sem porta exposta; `restart: unless-stopped`)
- [ ] `infra/Caddyfile` com `api.<dominio>` (plano B: hostname `srvXXXXXX.hstgr.cloud`)
- [ ] Uvicorn com `--proxy-headers --forwarded-allow-ips` (rede do Docker): atrás do Caddy, sem isso o rate limit do login veria todos os acessos com o IP do Caddy e bloquearia todo mundo junto
- [ ] Rodar migração + seed em produção
- [ ] Testar `https://api.<dominio>/api/health` e `/docs`
- [ ] UptimeRobot no `/api/health`

Commits sugeridos:

```bash
git commit -m "chore(backend): adiciona Dockerfile de produção"
git commit -m "chore(infra): adiciona compose de produção com proxy reverso Caddy e HTTPS"
```

---

## Dia 2 (21/10) — Frontend, deploy e vídeo

### Etapa 9 — Esqueleto do frontend

Status: pendente

- [ ] Vite + React + TS, Tailwind, shadcn/ui, Router, TanStack Query, Axios
- [ ] Cliente Axios com interceptor de JWT e tratamento de 401
- [ ] Tema claro/escuro com persistência
- [ ] Layout base (header, toggle de tema)
- [ ] Vitest + Testing Library + **MSW** (handlers base e utilitário `renderWithProviders`)
- [ ] **Testes:** FE9 (401 → login) · FE10 (tema)

Commits sugeridos:

```bash
git commit -m "chore(frontend): cria app React com Vite, Tailwind e shadcn/ui"
git commit -m "feat(frontend): adiciona cliente da API e provider do TanStack Query"
git commit -m "feat(frontend): adiciona alternância de tema claro/escuro"
git commit -m "test(frontend): configura Vitest com MSW e cobre redirecionamento de auth e tema"
```

### Etapa 10 — Login

Status: pendente

- [ ] Página de login (React Hook Form + Yup) com credenciais demo visíveis
- [ ] Contexto de auth e rotas protegidas

Commit sugerido:

```bash
git commit -m "feat(frontend): adiciona página de login e rotas protegidas"
```

### Etapa 11 — Painel de incidentes

Status: pendente

- [ ] Cards de resumo (clicáveis → aplicam filtro)
- [ ] Lista priorizada (barra de criticidade, ícone da categoria, tempo de espera vivo, responsável)
- [ ] Filtros em chips, sincronizados com a URL; padrão = Aberto + Em Investigação
- [ ] Skeleton, estado vazio, estado de erro com "Tentar novamente"
- [ ] Polling + indicador "atualizado há X s"
- [ ] **Testes:** FE1–FE5

Commits sugeridos:

```bash
git commit -m "feat(frontend): adiciona cards de resumo dos incidentes"
git commit -m "feat(frontend): exibe lista de incidentes priorizada"
git commit -m "feat(frontend): adiciona filtros de criticidade, categoria e status sincronizados com a URL"
git commit -m "feat(frontend): trata estados de carregamento, vazio e erro"
git commit -m "feat(frontend): atualiza incidentes automaticamente com polling e indicador de atualização"
git commit -m "test(frontend): cobre estados da lista, exibição por prioridade e filtros"
```

### Etapa 12 — Ações e concorrência no front

Status: pendente

- [ ] Drawer de detalhe com histórico de eventos
- [ ] Assumir / liberar / mudar status com update otimista e rollback
- [ ] 409 → toast explicando quem agiu antes + recarga
- [ ] Botões com spinner e desabilitados durante a ação
- [ ] Banner offline (`onlineManager`)
- [ ] **Testes:** FE6 (otimista + 409) · FE7 (erro de rede + duplo clique) · FE8 (offline)

Commits sugeridos:

```bash
git commit -m "feat(frontend): adiciona drawer de detalhe do incidente com linha do tempo de eventos"
git commit -m "feat(frontend): assume e muda status de incidentes com atualização otimista"
git commit -m "feat(frontend): trata conflitos 409 com rollback e feedback ao usuário"
git commit -m "feat(frontend): exibe aviso offline e pausa ações sem rede"
git commit -m "test(frontend): cobre rollback otimista, conflitos e modo offline"
```

### Etapa 13 — Criar e editar incidente

Status: pendente

- [ ] Formulário com criticidade sugerida pela categoria
- [ ] Edição com `version`; exclusão com confirmação
- [ ] Teste: validação do formulário e sugestão de criticidade

Commit sugerido:

```bash
git commit -m "feat(frontend): adiciona formulário de criação e edição de incidente"
```

### Etapa 14 — Testes ponta a ponta (Playwright)

Status: pendente

- [ ] Playwright rodando contra a stack local (`docker compose` + front)
- [ ] E1: login → painel → filtrar → abrir detalhe
- [ ] **E2: dois analistas em contextos separados clicam "Assumir"; só um vence** (gravar como evidência para o vídeo)
- [ ] E3: assumir → fechar com nota → some do filtro padrão

Commit sugerido:

```bash
git commit -m "test(e2e): cobre fluxo de login e claim simultâneo entre dois analistas"
```

### Etapa 15 — Deploy do front e CI

Status: pendente

- [ ] Vercel: `VITE_API_URL`, `vercel.json` com rewrite para SPA
- [ ] (Opcional) domínio `logos.<dominio>` na Vercel
- [ ] Ajustar o CORS da API para o domínio final
- [ ] GitHub Actions: lint + testes + cobertura do backend (MySQL como service container) e do frontend
- [ ] Badge do CI no README

Commits sugeridos:

```bash
git commit -m "chore(frontend): configura deploy da SPA na Vercel"
git commit -m "ci: executa lint, testes e cobertura do backend e do frontend"
```

### Etapa 16 — Documentação final

Status: pendente

- [ ] README: visão do problema, demo + credenciais, diagrama, setup local (Docker), **como rodar os testes**, decisões, uso de IA, próximos passos
- [ ] Screenshots/GIF (modo claro e escuro)

Commit sugerido:

```bash
git commit -m "docs: escreve README com setup, arquitetura, testes e decisões técnicas"
```

### Etapa 17 — Vídeo e entrega

Status: pendente

- [ ] Ensaiar o roteiro (PRD §11) e gravar em no máximo 5 min
- [ ] Publicar como **não listado** no YouTube; testar em aba anônima
- [ ] Pasta pública (Google Drive) com um documento contendo os 3 links
- [ ] Testar todos os links em aba anônima
- [ ] Voltar o branch padrão do GitHub para `main` (Settings → General → Default branch)
- [ ] Enviar pelo formulário da plataforma dentro do prazo

---

## Diário

### 20/10/2026

- Leitura do case e levantamento de requisitos.
- Análise do CV e dos projetos em `G:\` para definir a stack.
- Decisões D1–D8 registradas.
- Criados `PRD.md` e `progress.md`.
- Adicionada a estratégia de testes (PRD §8): matriz cenário → teste; testes passam a fazer parte de cada etapa (D9–D11).
- VPS identificada: Ubuntu 26.04 LTS, KVM 2, **expira em 02/11/2026**.
- VPS verificada: Docker 29.7.2 + Compose v5.5.0 instalados, nenhum container, portas 80/443 livres.
- Firewall `ufw` ativado com OpenSSH, 80 e 443.
- Prazo confirmado: 21/10/2026 às 23h59. Cronograma refeito com ordem de corte (PRD §10.1).
- Domínio: `logos-api.startbc.online` para a API (D6 atualizada). Registro A criado e já propagado.
- PR #3 (Etapa 4) mergeado por engano na `main` em vez do `env/dev`. Corrigido com um novo PR do mesmo branch para o `env/dev`, sem revert nem force push: as duas branches ficam com o mesmo código e os próximos PRs `env/dev` → `main` seguem sem conflito. Prevenção: branch padrão do GitHub trocado para `env/dev` durante o desenvolvimento.
