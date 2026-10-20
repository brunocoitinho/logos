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
| 1–3 | `feat/backend-scaffold` | env/dev |
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

Status: pendente

- [ ] Engine/sessão SQLAlchemy (`pool_pre_ping`, `pool_recycle`, timeouts)
- [ ] Models `User`, `Incident` (com `version_id_col`), `IncidentEvent`
- [ ] Enums de categoria, criticidade e status
- [ ] Alembic + migração inicial com índices
- [ ] pytest + `conftest.py`: banco de teste MySQL isolado, limpeza entre testes, fixtures de analistas e tokens, factory de incidentes
- [ ] `pytest-cov` configurado

Commits sugeridos:

```bash
git commit -m "feat(backend): adiciona sessão do banco e models SQLAlchemy"
git commit -m "feat(backend): adiciona migração inicial do Alembic para usuários e incidentes"
git commit -m "test(backend): configura pytest com banco MySQL de teste isolado e fixtures"
```

### Etapa 3 — Seed e simulador

Status: pendente

- [ ] `scripts/seed.py`: 3 analistas + ~100 incidentes realistas (BRs, km, cidades, placas Mercosul)
- [ ] `scripts/simulate_trucks.py`: cria incidentes a cada N segundos (para a demo)

Commit sugerido:

```bash
git commit -m "feat(backend): adiciona script de seed e simulador de incidentes dos caminhões"
```

### Etapa 4 — CRUD, filtros e validação

Status: pendente

- [ ] Schemas Pydantic de entrada e saída (validação estrita, `extra="forbid"`)
- [ ] `GET /api/incidents` com filtros múltiplos, busca, paginação e ordenação por prioridade
- [ ] `GET /api/incidents/summary`
- [ ] `GET/POST/PATCH/DELETE` (soft delete)
- [ ] Handler de erros com formato padronizado
- [ ] **Testes:** V1–V4 (validação) · F1–F5 (filtros, ordem de prioridade, summary)

Commits sugeridos:

```bash
git commit -m "feat(backend): adiciona schemas de incidente com validação estrita"
git commit -m "feat(backend): implementa CRUD de incidentes com ordenação por prioridade e filtros"
git commit -m "feat(backend): adiciona endpoint de resumo dos incidentes"
git commit -m "feat(backend): padroniza respostas de erro com handlers globais de exceção"
git commit -m "test(backend): cobre validação de entrada, filtros e ordenação por prioridade"
```

### Etapa 5 — Autenticação

Status: pendente

- [ ] Hash bcrypt, emissão e validação de JWT
- [ ] `POST /api/auth/login` (com rate limit) e `GET /api/auth/me`
- [ ] Rotas de incidentes protegidas
- [ ] CORS configurado por variável de ambiente
- [ ] **Testes:** S1–S4

Commits sugeridos:

```bash
git commit -m "feat(backend): adiciona autenticação JWT e protege as rotas de incidentes"
git commit -m "feat(backend): limita tentativas de login e configura CORS"
git commit -m "test(backend): cobre autenticação, limite de tentativas e CORS"
```

### Etapa 6 — Ciclo de vida, concorrência e resiliência (núcleo do case)

Status: pendente

- [ ] Serviço de transições (máquina de estados do PRD §4.2)
- [ ] `claim` atômico, `release`, `transition` com `version`
- [ ] 409 com estado atual e nome de quem agiu
- [ ] Registro em `incident_events` + `GET /api/incidents/{id}/events`
- [ ] `Idempotency-Key` no POST
- [ ] Retry com backoff (`tenacity`) em falha transitória; 503 quando o banco está fora
- [ ] **Testes de concorrência:** C1 (10 threads → 1 vencedor) · C2–C6
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
