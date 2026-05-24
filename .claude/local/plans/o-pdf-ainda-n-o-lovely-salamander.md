---
tenant_id: "face-before-after"
project: "face-before-after"
module: "plans/o-pdf-ainda-n-o-lovely-salamander"
file_path: ".claude/plans/o-pdf-ainda-n-o-lovely-salamander.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Sintoma reportado: ao baixar o PDF da análise, somente a capa com o score aparece; as páginas de 'Principais Achados' e 'Recomendações Clínicas' saem em branco.
tags:
  - "planning"
rag_keywords:
  - "ainda"
  - "lovely"
  - "plans"
  - "salamander"
related_modules: []
depends_on: []
used_by: []
---
# PDF em branco — corrigir persistência de `analysis_report`

> **Status (2026-05-24): ✅ DONE.** Fix shipped together with PR-67/68/69 (`backend/app/vision/services/pdf_builder.py` + Nest `PdfService` + frontend button). See [STATUS_LEDGER_2026-05-24.md](./STATUS_LEDGER_2026-05-24.md). Historical document.

## Contexto

Sintoma reportado: ao baixar o PDF da análise, somente a capa com o score aparece; as páginas de "Principais Achados" e "Recomendações Clínicas" saem em branco.

Suspeita inicial (errada) era contrato Python ↔ Nest no payload do `/generate-pdf`. Investigação revelou que **o pipeline de análise está silenciosamente falhando em produção**:

1. Toda chamada a `POST /v1/analysis/evaluate` retorna **HTTP 500** com:
   ```
      QueryFailedError: column "metricRegistryVersionRefVersion" of relation "analysis_report" does not exist
         ```
         2. Resultado no banco (verificado via `psql`):
            - `analysis_report`: **0 rows**
               - `metric_evaluation`: 0 rows
                  - `metric_evaluation_against_ideal`: 0 rows
                     - `recommendation_link`: 0 rows
                     3. Quando o frontend chama `fetchNarrative(reportId)`, o backend devolve `{findings: [], recommendations: []}` (porque a tabela está vazia ou o report nem existe).
                     4. O PDF então é gerado com `findings: []` e `recommendations: []` — Python aceita arrays vazios, `_build_findings` retorna lista vazia, e as seções inteiras desaparecem.

                     Causa raiz: em [`analysis-report.entity.ts`](nest/src/modules/analysis/infrastructure/entities/analysis-report.entity.ts), quatro `@ManyToOne` foram declarados **sem `@JoinColumn`**. O TypeORM, ao gerar o INSERT, infere um nome de coluna composto a partir da propriedade da relação (`metricRegistryVersionRef` + PK do alvo `version` → `metricRegistryVersionRefVersion`), que não existe na tabela. O INSERT explode, a transação dá rollback, nada é persistido.

                     As relações órfãs estão nas linhas 73-74, 79-80, 85-86 e 91-92. Confirmado por `grep`: **nenhuma das propriedades `*Ref` é lida em outro arquivo do projeto** — só existem na entidade. O código no orchestrator (`orchestrator.service.ts:340-358`) só atribui o campo string (ex.: `metricRegistryVersion: metricRegistryVer`), nunca a relação.

                     ## Mudança

                     Arquivo único:
                     [`nest/src/modules/analysis/infrastructure/entities/analysis-report.entity.ts`](nest/src/modules/analysis/infrastructure/entities/analysis-report.entity.ts) — remover os 4 `@ManyToOne` órfãos e seus imports.

                     **Antes (linhas 70-92):**
                     ```typescript
                     @Column({ name: 'metric_registry_version', type: 'text', nullable: true })
                     metricRegistryVersion!: string | null;

                     @ManyToOne(() => MetricRegistryVersionEntity)
                     metricRegistryVersionRef!: Relation<MetricRegistryVersionEntity> | null;

                     @Column({ name: 'ideals_version', type: 'text', nullable: true })
                     idealsVersion!: string | null;

                     @ManyToOne(() => IdealsVersionEntity)
                     idealsVersionRef!: Relation<IdealsVersionEntity> | null;

                     @Column({ name: 'threshold_config_version', type: 'text', nullable: true })
                     thresholdConfigVersion!: string | null;

                     @ManyToOne(() => AnalysisThresholdConfigEntity)
                     thresholdConfigVersionRef!: Relation<AnalysisThresholdConfigEntity> | null;

                     @Column({ name: 'severity_collapse_version', type: 'text', nullable: true })
                     severityCollapseVersion!: string | null;

                     @ManyToOne(() => SeverityCollapsePolicyEntity)
                     severityCollapseVersionRef!: Relation<SeverityCollapsePolicyEntity> | null;
                     ```

                     **Depois:**
                     ```typescript
                     @Column({ name: 'metric_registry_version', type: 'text', nullable: true })
                     metricRegistryVersion!: string | null;

                     @Column({ name: 'ideals_version', type: 'text', nullable: true })
                     idealsVersion!: string | null;

                     @Column({ name: 'threshold_config_version', type: 'text', nullable: true })
                     thresholdConfigVersion!: string | null;

                     @Column({ name: 'severity_collapse_version', type: 'text', nullable: true })
                     severityCollapseVersion!: string | null;
                     ```

                     E remover do topo do arquivo: imports de `MetricRegistryVersionEntity`, `IdealsVersionEntity`, `AnalysisThresholdConfigEntity`, `SeverityCollapsePolicyEntity`, mais `ManyToOne` e `Relation` do `typeorm` (se não usados em outras partes do arquivo — verificar antes de remover).

                     Por que remover em vez de adicionar `@JoinColumn`:
                     - As propriedades `*Ref` não são usadas em lugar nenhum do projeto (confirmado por `grep`).
                     - O orchestrator persiste apenas o campo string scalar; nunca instancia o objeto da relação.
                     - Manter `@JoinColumn` seria carregar relações TypeORM "fantasma" que ninguém lê — peso morto que aumenta a chance do mesmo bug ressurgir.

                     ## Verificação

                     1. Rebuild + restart do Nest:
                        ```bash
                           cd nest && npm run build
                              docker compose restart orchestrator
                                 ```

                                 2. Confirmar que `POST /v1/analysis/evaluate` agora retorna 200 e persiste:
                                    - Subir uma foto via UI (`http://localhost:9016`) ou enviar landmarks diretamente.
                                       - Checar logs: `docker compose logs orchestrator --tail 50 | grep -iE "evaluate|error"` — não pode aparecer mais o `QueryFailedError`.
                                          - Checar DB:
                                               ```bash
                                                    docker exec face-postgres psql -U faceanalysis -d face_analysis -c "SELECT COUNT(*) FROM analysis_report"
                                                         docker exec face-postgres psql -U faceanalysis -d face_analysis -c "SELECT severity_5, COUNT(*) FROM metric_evaluation_against_ideal GROUP BY severity_5"
                                                              ```
                                                                 - Esperado: `analysis_report > 0` e `metric_evaluation_against_ideal` com pelo menos algumas linhas não-`ideal`.

                                                                 3. Confirmar que o PDF agora vem completo:
                                                                    - Na UI, abrir `/premium` após uma análise, clicar "Baixar relatório (PDF)".
                                                                       - Esperado: PDF com 4 seções — Capa (score) + "Principais Achados" (≥1 finding) + "Recomendações Clínicas" (≥1 rec, com `display_text_long_pt` renderizado) + Disclaimer.

                                                                       4. Type-check:
                                                                          ```bash
                                                                             cd nest && npx tsc --noEmit -p tsconfig.build.json
                                                                                ```
                                                                                   Esperado: 0 erros.

                                                                                   ## Não-objetivos (deixa para depois)

                                                                                   - O contrato Python ↔ Nest do PDF (`region_pt` / `severity_pt` que o `RunPdfController` envia e `pdf.py` descarta) **já está funcionando por fallback**: o builder usa `metric_id` quando `region_pt` falta e mostra "indeterminada" quando `severity_pt` não casa. Não é a causa do bug atual. Refatoração desse contrato é cosmético — fica fora deste plano.
                                                                                   - O `pdf.service.ts` (rota DB-backed `POST /v1/analysis/:id/pdf`) também não é o caminho usado pelo frontend; o botão chama `POST /v1/analysis/run/:runId/pdf` (RunPdfController). Não tocar.
                                                                                   - As 62 métricas do glossário sem conteúdo editorial (T1 do plano de wiring) — independente.
                                                                                   