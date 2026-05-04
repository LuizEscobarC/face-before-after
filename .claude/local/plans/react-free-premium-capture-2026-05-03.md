# Plano: React + Free/Premium + Captura de Foto

## Objetivo
Entregar uma experiência web com duas telas de resultado separadas (Free e Premium), com captura de foto por upload e câmera, mantendo o motor Python atual como backend analítico.

## Escopo
1. Backend HTTP para análise Free/Premium
2. Frontend React (Vite + TypeScript)
3. Tela de captura com upload + webcam/câmera
4. Guia de captura estilo 3x4
5. Tela de resultado Free separada da Premium
6. Ajustes de comandos de desenvolvimento

## Etapas de execução
1. Criar `api_server.py` com endpoints:
- `POST /api/analyze/free`
- `POST /api/analyze/premium`
- `GET /api/capture-guidelines`

2. Reutilizar `mvp_pipeline.run(...)` por modo:
- `teaser` para Free
- `premium` para Premium

3. Criar app React em `frontend/`:
- rota captura
- rota resultado free
- rota resultado premium

4. Implementar captura:
- upload de arquivo (`png/jpg/jpeg`)
- webcam via `getUserMedia`
- suporte mobile via `capture="user"`

5. Implementar guia visual da foto:
- iluminação frontal
- distância recomendada 0.5m a 0.8m
- zoom 2x quando possível
- rosto centralizado e frontal
- composição estilo 3x4

6. Integrar front com API e separar UX Free/Premium

7. Atualizar `justfile` com comandos web/api e validar

## Verificação
1. `just lint`
2. `just test-q`
3. subir API e web, enviar imagem PNG e JPG
4. validar telas separadas Free e Premium

## Recommended Execution Model
- **Model:** sonnet
- **Reason:** implementação full-stack de complexidade média/alta com integração backend Python existente + frontend React com câmera/upload e diferenciação de UX por plano.
