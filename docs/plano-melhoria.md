# Plano de Melhoria — Lemefy

**Versão**: 1.0  
**Data**: 2026-07-25  
**Status**: Fase 1 concluída  

---

## Princípio Diretor

Reduzir risco operacional do legado JS enquanto expande a superfície de código TypeScript seguro, mantendo o ritmo de entrega de features.

---

## Fase 1 — Estabilização (0–2 meses)

**Objetivo**: diminuir acoplamento com o legado e aumentar confiabilidade do build/deploy.

| Ação | Esforço | Impacto | Como | Status |
|------|---------|---------|------|--------|
| **1.1 Quebrar `api/server/index.js`** | Médio | Alto | Extrair bootstrapping para módulos: `api/server/bootstrap/health.js`, `middleware.js`, `routes.js`. O arquivo original tinha 531 linhas; após refatoração ficou com ~390. | Concluído |
| **1.2 Criar adapters finos em `/api`** | Baixo | Alto | Criado `api/adapters/app.js` como barrel file para centralizar requires de `@lemefy/api`. `index.js` agora importa via `require('~/adapters/app')`. | Concluído |
| **1.3 Adicionar validação de env vars** | Baixo | Alto | Criado `api/server/config/env.validate.js` com `zod`. Integrado no início do boot. Falha rápido com mensagens claras. Defaults seguros para Postgres. | Concluído |
| **1.4 Configurar `tsstrict` no `packages/api`** | Baixo | Médio | `strict: true` já existia. Adicionado `noUncheckedIndexedAccess: true` no `packages/api/tsconfig.json`. | Concluído |
| **1.5 Melhorar health checks** | Baixo | Médio | Adicionados endpoints `/health/mongo`, `/health/meilisearch`, `/health/redis`, `/health/postgres` via módulo `api/server/bootstrap/health.js`. | Concluído |

### Marco Fim Fase 1
- `api/server/index.js` reduzido de 531 para ~390 linhas.
- Validação de env vars com `zod` ativa no boot.
- Health checks por dependência disponíveis.
- `packages/api/tsconfig.json` com `strict` + `noUncheckedIndexedAccess`.

---

## Fase 2 — Migração Segura (3–5 meses)

**Objetivo**: mover rotas de maior volume/risco do legado JS para TS, sem quebrar funcionalidades existentes.

| Ação | Esforço | Impacto | Como |
|------|---------|---------|------|
| **2.1 Inventariar rotas por volume/risco** | Baixo | Alto | Rankear rotas de `/api/server/routes/` por frequência de mudança, timeout médio e criticidade. Começar pelas isoladas e com baixo acoplamento. |
| **2.2 Portar rotas de Auth para TS** | Médio | Alto | `/api/server/routes/auth.js` é crítica, mas bem delimitada. Mover para `/packages/api/src/auth/routes.ts` com os handlers já existentes. |
| **2.3 Portar rotas de Messages/Convos para TS** | Alto | Alto | Maior volume de requests. Fazer feature flags para permitir rollback por endpoint. |
| **2.4 Criar camada de compatibilidade type-safe** | Médio | Alto | Tipos compartilhados entre `/api` e `/packages/api` via `packages/data-provider` para evitar duplicação. |
| **2.5 Automatizar migração incremental** | Médio | Médio | Criar script que identifique `require('~/models')` não usados em rotas já portadas, detectando débito técnico do legado. |
| **2.6 Shadow testing** | Baixo | Médio | Rodar rota nova em paralelo com a antiga comparando respostas antes de desligar o legado. |

### Marco Fim Fase 2
≥30% dos endpoints de maior volume servidos por código TS; rollback automatizado por endpoint via feature flag.

---

## Fase 3 — Performance e Observabilidade (5–7 meses)

**Objetivo**: preparar a arquitetura para multi-instância e escalar com dados reais.

| Ação | Esforço | Impacto | Como |
|------|---------|---------|------|
| **3.1 Padronizar tracing** | Médio | Alto | Garantir que rotas críticas tenham spans nomeados; usar OpenTelemetry para medir latência real do boot e das rotas lentas. |
| **3.2 Reduzir resumable streams recovery time** | Médio | Alto | Perfilamento do fluxo atual de reconexão com Redis; implementar lazy restore ao invés de eager fetch. |
| **3.3 Migrar queries repetitivas para batch** | Baixo | Médio | Identificar rotas que fazem N+1 reads no Mongo e consolidar em `Promise.all` ou agregações. |
| **3.4 Implementar cache warming** | Médio | Médio | Pré-carregar configurações e permissões mais usadas no startup ao invés de lazy-load sob demanda. |
| **3.5 Reduzir bundle do frontend** | Médio | Médio | Code splitting por feature (MCP, Agents, Skills) já usa lazy loading — auditar duplicação em vendor chunks. |

### Marco Fim Fase 3
P95 do boot em ≤60s; latência P95 de `/api/agents/chat` reduzida em ≥20%; traces cobrem 100% das rotas de autenticação.

---

## Fase 4 — Anti-débito Contínuo (7+ meses)

**Objetivo**: manter o ritmo sem reacumular legado.

| Ação | Esforço | Impacto | Como |
|------|---------|---------|------|
| **4.1 Linter + typecheck em PR obrigatório** | Baixo | Alto | Já existe `npm run lint` e `tsc --noEmit`; bloquear merge se falhar. |
| **4.2 Testes de contrato para rotas** | Médio | Médio | Adicionar testes de integração leves que validam schema de request/response por rota, não apenas por componente. |
| **4.3 Criar guia de "não legado"** | Baixo | Médio | Documentar o fluxo de migração: como testar, como fazer feature flag, como portar uma rota. |
| **4.4 Depreciação formal do `/api`** | Baixo | Médio | Marcar módulos do legado com `@deprecated` em código e tracking de usage. Quando ninguém mais usar, apagar. |

---

## Priorização por Esforço × Impacto

### Alto Impacto / Baixo Esforço (FAÇA PRIMEIRO)
- 1.3 Validação de env vars
- 1.4 Configurar `tsstrict`
- 2.1 Inventariar rotas
- 3.3 Reduzir queries repetitivas
- 4.1 Linter/typecheck obrigatório em PR

### Alto Impacto / Médio Esforço (FASE 1 e 2)
- 1.1 Quebrar `index.js`
- 1.2 Adapters finos
- 2.2 Portar Auth
- 2.3 Portar Messages/Convos
- 3.1 Padronizar tracing

### Alto Impacto / Alto Esforço (FASE 2 e 4)
- 2.4 Camada de compatibilidade
- 2.5 Automatizar migração
- 2.6 Shadow testing
- 4.2 Testes de contrato

---

## Métricas de Acompanhamento

| Métrica | Baseline alvo | Medição |
|---------|---------------|---------|
| Linhas de código legado JS | -20% em 6 meses | `find /api -name "*.js" \| xargs wc -l` |
| Rotas em TS | ≥30% dos endpoints críticos | count de rotas em `/packages/api/src` |
| Tempo de boot (P95) | ≤60s | `/readyz` + métricas Prometheus |
| Latência P95 chat | -20% | `/metrics` do `prom-client` |
| Cobertura de testes | manter ≥80% | `npm run test:all` |
| Falhas de cache JWT | zero | logs de `req.user` staletrace fase 2.3
- Testes de contrato fase 4.2
- Cache warming fase 3.4

---

## Riscos Operacionais Críticos

1. **Cache JWT + OpenID burst**: instabilidades em auth podem servir `req.user` stale. Garantir que toda mutação de documento de usuário invalide o cache.
2. **Rollback de rotas migradas**: feature flags por endpoint são obrigatórias na Fase 2.
3. **Docker build cache**: trabalhar em camadas para não rebuidar `node_modules` a cada alteração.
4. **Multi-instância e leader election**: Redis é necessário para streams e caches em produção; validar antes de escalar horizontalmente.
