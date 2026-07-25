# Inventário de Rotas — Fase 2

**Data**: 2026-07-25  
**Objetivo**: migrar rotas do legado JS para `packages/api` com segurança.

---

## Classificação por tamanho (linhas)

| Arquivo | Tamanho | Categoria | Prioridade |
|---------|---------|-----------|------------|
| `routes/mcp.js` | 982 | Backend | Alta |
| `routes/prompts.js` | 562 | Backend | Alta |
| `routes/share.js` | 545 | Backend | Média |
| `routes/messages.js` | 445 | Backend | Alta |
| `routes/convos.js` | 393 | Backend | Alta |
| `routes/skills.js` | 374 | Backend | Média |
| `routes/memories.js` | 345 | Backend | Média |
| `routes/config.js` | 316 | Backend | Média |
| `routes/accessPermissions.js` | 197 | Backend | Média |
| `routes/roles.js` | 204 | Backend | Média |
| `routes/oauth.js` | 221 | Auth | Alta |
| `routes/auth.js` | 105 | Auth | Alta |

---

## Critérios de priorização

1. **Volume de requests**: rotas chamadas em quase todo request.
2. **Risco de quebra**: rotas com lógica complexa ou efeitos colaterais.
3. **Acoplamento**: rotas dependem de poucos módulos internos.
4. **Testes**: existência de specs que ajudam no shadow testing.

---

## Ordem sugerida de migração

1. `routes/oauth.js` / `routes/auth.js` — auth é alta visibilidade, mas bem delimitada.
2. `routes/messages.js` + `routes/convos.js` — maior volume de requests do chat.
3. `routes/mcp.js` — grande, mas isolada; gains grandes de manutenibilidade.
4. `routes/prompts.js` / `routes/share.js` — alto valor, médio risco.
5. `routes/skills.js` / `routes/memories.js` — features específicas.
6. `routes/config.js` / `routes/accessPermissions.js` / `routes/roles.js` — admin/segurança.

---

## Observação

- A refatoração da Fase 1 reduziu `api/server/index.js` de 531 para ~390 linhas.
- As rotas continuam em JS puro; a migração para TS será feita em `packages/api/src` com adapters mínimos no `/api`.
