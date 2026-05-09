1. Avaliação geral
O DDL atual está bem desenhado para o que se propõe a cobrir. Os comentários nas colunas, o versionamento de configurações editáveis (quality_threshold_config, diagnostic_def_version, impact_table_version), a separação entre raw_score/penalized_score/final_score em priority_score_audit, o uso de JSONB para evidências, e o controle granular de pipeline_allowed/comparison_allowed mostram que o autor pensou em auditoria, calibração sem deploy e UX de degradação. Essa base é sólida.
O problema é que ele foi modelado para um pipeline qualidade → diagnóstico → decisão, e o plano de Fase 1–4 introduz uma etapa intermediária — métrica atômica avaliada contra ideal — que é hoje invisível no schema. FactorResult é referenciado em diagnostic_definition.trigger_factor_ids e em confidence_breakdown.factor_contributions, mas não existe tabela para fatores nem para métricas atômicas. Tudo flui como JSONB livre, o que mata auditoria por métrica e impede comparação longitudinal granular.
A revisão abaixo é organizada em: o que falta criar, o que precisa ajustar, como consolidar versionamento, e em que ordem migrar.

1. O que falta criar — camada de métrica e ideal (gap crítico)
Sem isso, nada do plano funciona. É o que vai sustentar Fase 1, Fase 2 e tudo a jusante.
2.1 Catálogo de métricas — metric_definition
Tabela com a "carteira de identidade" canônica de cada métrica produzida no FastAPI. É o espelho persistido daquilo que o metric_registry.py declara em código. Precisa carregar: metric_id (PK, snake_case, estável), version (FK para metric_registry_version), display_name_pt, region (eyes, brows, nose, mouth, jaw, chin, midface, cheeks, forehead, global, symmetry, photo_quality), family (a subfamília da Fase 1.3 — symmetry, thirds, fifths, etc.), unit (px, ratio, degrees, percent, index_0_1, intercanthal_units), requires_pixel_analysis (boolean — flag para métricas adiadas), presentation_only (boolean — phi/golden e similares que vão em overlay mas não no score), dependency_landmarks (JSONB — quais índices de landmark consome), default_weight_in_region (float — peso default; o real fica em region_metric_weight), min_confidence_to_display (float, default 0.4).
Essa tabela existe não para ser consultada em runtime (o registry em código manda), mas para garantir que análises antigas saibam o que cada metric_id significou no momento em que rodaram. É o mesmo padrão de diagnostic_definition no DDL atual.
2.2 Avaliação de métrica — metric_evaluation
Esta é a tabela central que falta. Uma linha por (sessão, métrica). Deve carregar: id (UUID), session_id (UUID, indexado), analysis_report_id (FK para o aggregate root descrito mais adiante), metric_id (FK para metric_definition), metric_definition_version (snapshot da versão usada), value (float — número bruto), error (float — incerteza propagada), confidence_raw (float — antes de penalidades regionais), confidence_final (float — após penalidades), regional_penalty_applied (float — qual valor saiu do regional_penalties do Módulo 0), pose_penalty_applied (float), is_low_confidence (boolean derivado), dependency_landmarks_unstable (JSONB — quais landmarks estavam instáveis, se houver multi-captura).
Esse objeto é o que alimenta tanto a Fase 2 (comparação com ideal) quanto a Fase 3 (overlays decidem se desenham com base em confidence_final >= threshold) quanto a Fase 4 (templates de diagnóstico).
2.3 Comparação contra ideal — metric_ideal e metric_evaluation_against_ideal
O metric_ideals.yaml da Fase 2 precisa de um espelho versionado no banco. Crie metric_ideal com: id, version (FK para ideals_version), metric_id (FK), ideal_type (canonical, population_statistical, presentation_only), ideal_central_value (float), green_range_min, green_range_max, yellow_range_min, yellow_range_max, direction_label_above (texto curto, ex: "queixo retraído"), direction_label_below (ex: "queixo projetado"), population_reference_note (texto livre — onde a referência veio).
Para registrar como cada métrica de cada sessão se comportou contra o ideal, crie metric_evaluation_against_ideal com: metric_evaluation_id (FK 1:1), metric_ideal_id (FK), deviation_raw (valor − ideal central, na unidade da métrica), deviation_normalized (em unidades de tolerância verde), percentile (nullable), direction_label (snapshot do label aplicado), severity (enum: ideal | mild | moderate | strong | extreme), improvement_vector_x e improvement_vector_y (nullable — quando aplicável, alimenta as setas da Fase 3).
Separar a comparação em tabela própria 1:1 com a avaliação tem uma vantagem: você pode recalcular a comparação contra um ideals_version mais novo sem reprocessar landmarks. Útil quando você recalibrar e quiser reaplicar em histórico.
2.4 Camada de fator — factor_definition e factor_evaluation
O DDL atual fala em "factors" (trigger_factor_ids, factor_contributions) mas nunca os define. Para o plano funcionar, fatores são agregações nomeadas de métricas que depois disparam diagnósticos. Exemplos: factor_jaw_definition agrega ratio jawline-to-cheekbone + ângulo gonial + simetria mandibular; factor_eye_attractiveness agrega canthal tilt + aperture ratio + eye spacing.
Crie factor_definition (versionada) com: factor_id, version, display_name_pt, region, composition (JSONB declarando quais metric_id entram e com que peso), aggregation_method (weighted_mean, min, geometric_mean).
E factor_evaluation com uma linha por (sessão, fator): id, analysis_report_id, factor_id, factor_definition_version, value (float — agregado), confidence (float — propagada das métricas componentes), contributing_metric_ids (JSONB — snapshot de quais métricas entraram).
Com isso, diagnostic_definition.trigger_factor_ids finalmente aponta para algo concreto, e confidence_breakdown.factor_contributions tem semântica auditável.
2.5 Scores agregados — regional_score e global_score
Hoje não há tabela para o score por região nem para o score global. O plano os define como saída obrigatória. Crie regional_score com uma linha por (sessão, região): id, analysis_report_id, region, score_0_100 (float), confidence_aggregate (float — a confiança média ponderada das métricas que entraram), contributing_metric_ids (JSONB), weights_version (snapshot de qual versão de region_metric_weight foi usada).
E global_score com uma linha por sessão: id, analysis_report_id, score_0_100 (nullable — null quando regiões críticas estão abaixo do threshold de confiança), is_displayable (boolean), regional_breakdown (JSONB — qual região contribuiu com quanto), global_weights_version.
Importante: ambos guardam nullable em score_0_100 quando a confiança não permite expor. Isso evita mostrar score baixo de confiança como se fosse confiável.
2.6 Pesos editáveis — region_metric_weight e global_weights
Os pesos por região e os pesos globais (35/35/20/10 do plano) precisam virar tabelas, não constantes em código. Crie region_metric_weight (versionada) com: id, version, region, metric_id, weight, is_active. E global_weight (versionada) com: id, version, dimension (symmetry, proportion, definition, photo_stability), weight.
Ambas se conectam a versões próprias para que mudança de calibração não invalide histórico.

1. O que falta criar — camada de overlays (Fase 3)
3.1 Catálogo — overlay_definition
Espelho persistido do overlay_definitions.yaml. Carrega: overlay_id, version, display_name_pt, description_pt, category (axis, grid, contour, mask, vector, heatmap, label), default_visible (boolean), z_order (int), legend_text_pt, is_decorative (boolean — para overlays como golden ratio que devem ser etiquetados).
3.2 Dependências — overlay_metric_dependency
N:N entre overlay_definition e metric_definition. Toda overlay depende de um conjunto de métricas para fazer sentido. Se as métricas das quais depende estão com confidence_final abaixo do threshold, a overlay não deve renderizar.
Carrega: overlay_id, metric_id, is_critical (boolean — se essa métrica falhar de confiança, a overlay é suprimida; se não-crítica, a overlay degrada mas renderiza).
3.3 Assets renderizados — rendered_asset
Toda imagem anotada que o /vision/render gera deve ser registrada. Carrega: id, analysis_report_id, asset_type (single_annotated, region_gallery_item, before_ideal_composition, report_pdf), region (nullable — preenchido em galeria por região), overlay_ids_applied (JSONB), format (png, jpg, pdf), storage_url, dimensions (JSONB), generated_at, expires_at (idêntico à política de photo_storage).
Isso permite que o frontend recupere a imagem renderizada sem refazer a renderização e que o usuário possa baixar variações.

1. O que falta criar — camada de texto e plano de ação (Fase 4)
4.1 Templates — diagnostic_template
Hoje diagnostic_definition.base_explanation_template guarda um único template. O plano da Fase 4.1 exige três tamanhos por (métrica, severidade, direção). Crie diagnostic_template com: id, version (FK para diagnostic_def_version ou versão própria — sugiro própria), metric_id (FK), severity (enum), direction (enum), size (short, medium, long), template_pt (texto com placeholders), placeholders_used (JSONB para validação).
Indexe por (metric_id, severity, direction, size). Em runtime, o template_renderer resolve a tupla e interpola.
A diagnostic_explanation.simple_text continua existindo, mas passa a ser gerada a partir desses templates, não cadastrada à mão.
4.2 Catálogo de recomendações — recommendation_catalog
solution_reference no DDL atual é um ponteiro fraco — só carrega slug, tipo e min_severity. O plano da Fase 4.3 exige um catálogo rico, indexado e versionado.
Crie recommendation_catalog: id (snake_case slug), version, category (photo, posture, lifestyle, styling, professional_referral, presentation_only), display_text_short_pt, display_text_long_pt, priority_default (int 1–5), effort_estimate (low, medium, high), risk_level (float 0–1 — alimenta o R do priority_score_audit), requires_professional (boolean), professional_type (nullable — dentist, physiotherapist, dermatologist, otolaryngologist).
E uma tabela de gatilho recommendation_trigger com: id, recommendation_id (FK), metric_id (FK), severity (enum), direction (enum), additional_conditions (JSONB — ex: "só dispara se também houver factor_X com severidade Y"). É a regra que mapeia (metric_id, severity, direction) → recomendação.
Por fim, recommendation_link (instância por sessão) substituindo a solution_reference atual: id, analysis_report_id, recommendation_id (FK), triggered_by_metric_evaluation_ids (JSONB), final_priority_in_session (int — após priorização), is_displayed_to_user (boolean — após corte por categoria/severidade).
4.3 Aggregate root — analysis_report
Aqui vem a peça que unifica tudo. Hoje o DDL tem diagnostic_report e decision_output como duas raízes paralelas, ambas referenciando session_id. Isso fragmenta a sessão.
O plano exige um aggregate raiz único (AnalysisReport) que amarra: scores, métricas, ideais, overlays sugeridos, diagnósticos derivados, decisões priorizadas, recomendações finais, disclaimers.
Crie analysis_report com: id, session_id, user_id, photo_quality_report_id (FK), landmark_payload_id (FK), metric_registry_version, ideals_version, weights_version, global_weights_version, overlay_catalog_version, recommendation_catalog_version, diagnostic_def_version, impact_table_version, status (espelha o de decision_output), disclaimer_text_snapshot (texto fixo legalmente sensível, congelado no momento), generated_at.
diagnostic_report e decision_output passam a referenciar analysis_report_id em vez de só session_id. Isso não quebra nada, só promove o agrupamento.

1. Ajustes nas tabelas existentes
5.1 photo_quality_report
Adicionar normalization_basis (enum: intercanthal, interpupillary, face_height — qual referência foi usada na normalização da Fase 1.2; sem isso, comparações longitudinais entre análises com bases diferentes ficam erradas) e analysis_report_id (FK opcional, populada após a análise rodar).
5.2 landmark_payload
Adicionar normalization_applied (boolean — se os landmarks armazenados já passaram pelo pré-processamento da Fase 1.2 ou se estão crus). É crucial saber, porque toda métrica espera landmarks normalizados.
Considere também adicionar landmark_stability_scores (JSONB) para suportar multi-captura no futuro — uma entrada por landmark com a variância observada. Pode ficar nullable agora.
5.3 regional_penalties
Adicionar campos para regiões que aparecem no plano e não estão cobertas: chin_penalty, mouth_penalty, forehead_penalty, midface_penalty. Hoje só tem cinco regiões, o plano usa onze.
5.4 diagnostic_definition
trigger_factor_ids (JSONB) deveria virar uma tabela relacional diagnostic_trigger para permitir queries inversas ("quais diagnósticos disparam para o factor X?"). Estrutura sugerida: id, diagnostic_definition_id (FK), trigger_type (factor, metric), target_id (factor_id ou metric_id), condition (JSONB com severidade/direção mínima), is_required (boolean — se múltiplos triggers, alguns são todos obrigatórios e outros são "qualquer um basta").
Isso desacopla rules de runtime e permite que DiagnosticGeneratorService.applyRules() faça join em vez de iterar JSONB.
base_explanation_template torna-se obsoleto após diagnostic_template existir. Mantenha por compatibilidade, marque como deprecated.
5.5 diagnostic_candidate
Adicionar analysis_report_id (FK), metric_evaluation_ids (JSONB — quais avaliações de métrica entraram no candidato; complementa a relação via factor_evaluation).
5.6 confidence_breakdown.factor_contributions
Hoje JSONB livre. Quando factor_evaluation existir, isso pode virar uma tabela confidence_factor_contribution com: id, confidence_breakdown_id (FK), factor_evaluation_id (FK), weight, contribution (peso × confiança do fator). Auditável e queryable.
5.7 priority_score_audit
A fórmula (I × S × C × A) × (1−R) × (1 − E×0.5) continua válida, mas os componentes I, S, C, A, E, R hoje vêm "de algum lugar" sem rastro. Adicione: impact_table_entry_id (FK — de onde I veio), severity_source_metric_evaluation_id (FK — qual avaliação determinou S), confidence_source_candidate_id (FK), risk_source_recommendation_id (FK — quando R vem do risk_level da recomendação).
Cinco FKs adicionadas dão rastreabilidade total. É o que RNF-D01 (auditabilidade) realmente exige.
5.8 solution_reference
Marcar como deprecated. Substituída por recommendation_link. Mantenha durante migração para não quebrar Decision atual; remova após Fase 4 estar madura.
5.9 impact_table_entry
Adicionar metric_id como chave alternativa (já tem diagnostic_id e region). O plano constrói impacto a partir de métricas, não só de diagnósticos — tem que aceitar ambos.

1. Consolidação de versionamento
Hoje existem três versões soltas: quality_threshold_config.version, diagnostic_def_version.version, impact_table_version.version. O plano exige mais quatro: metric_registry_version, ideals_version, weights_version (cobre region e global), overlay_catalog_version, recommendation_catalog_version, diagnostic_template_version.
Em vez de criar sete tabelas paralelas (X_version), considere consolidar em uma única analysis_versioning_set que age como "tag" de release: id (uuid), name (v2024.11.15), created_at, created_by, is_active, notes, e então uma tabela por versão específica (metric_registry_version, ideals_version, etc.) carregando set_id (FK opcional) que indica que aquela versão entrou num release agrupado.
A vantagem: em produção, ativar um conjunto coordenado é uma operação atômica ("ativar todas as versões do set v2024.11.15"). E analysis_report carrega tanto versioning_set_id (rastreio agrupado) quanto cada FK individual (rastreio fino).
Se essa consolidação for over-engineered para o estágio atual, mantenha versões separadas mas garanta que toda tabela de configuração editável tenha exatamente uma versão is_active=TRUE e que analysis_report registre todas elas como snapshot.

1. Coerência semântica que precisa ser definida antes do DDL final
Algumas decisões precisam ficar travadas no projeto antes de migrar — porque mudar depois exige migração de dados:
Base de normalização. O plano sugere intercanthal. Documentar e fixar. Toda métrica em unit=ratio será relativa a essa base. Se mudar depois, valores históricos ficam incomparáveis.
Granularidade da severidade. O DDL atual usa LEVE | MODERADO | SEVERO. O plano usa ideal | mild | moderate | strong | extreme (cinco níveis). Decida agora qual vence — ou crie um mapeamento estável. Recomendo cinco níveis no metric_evaluation_against_ideal e três no diagnostic_candidate, com regra clara de colapso.
Idioma dos templates. Tudo em português? Ou suporte multi-idioma desde já com sufixo _locale? Se a resposta é "português por enquanto", acrescente um campo locale mesmo assim, default 'pt-BR' — abrir para mais línguas depois fica trivial.
O que conta como "métrica que vai para score" vs "métrica decorativa". Definir o boolean presentation_only no metric_definition e respeitá-lo em todos os agregadores. Phi/golden e similares nunca entram em regional_score mesmo que apareçam em overlay.
Relacionamento analysis_report ↔ diagnostic_report ↔ decision_output. Decidir se vão coexistir (cada um continua como aggregate root paralelo, com FK opcional para analysis_report) ou se analysis_report vira a única raiz e os outros viram filhos. Migração mais suave: coexistência inicial, com analysis_report.diagnostic_report_id e analysis_report.decision_output_id como FKs. Refatoração mais limpa fica para depois.

1. Ordem de migração
Seguir esta ordem evita ter que fazer rollback de migrações intermediárias:
A primeira leva cria os catálogos: metric_registry_version, metric_definition, ideals_version, metric_ideal, factor_definition. Sem dados de sessão ainda — só o catálogo. Permite popular em paralelo com o desenvolvimento do Python.
A segunda leva cria as avaliações por sessão: metric_evaluation, metric_evaluation_against_ideal, factor_evaluation. Já com analysis_report_id como nullable inicialmente.
A terceira leva cria o aggregate root: analysis_report. Adiciona FKs para ele em photo_quality_report, diagnostic_report, decision_output, metric_evaluation, etc. Backfill com base em session_id.
A quarta leva cria scores e pesos: regional_score, global_score, region_metric_weight, global_weight, e suas versões.
A quinta leva cria a camada de overlay: overlay_definition, overlay_metric_dependency, rendered_asset, overlay_catalog_version.
A sexta leva cria a camada de texto e plano: diagnostic_template, recommendation_catalog, recommendation_trigger, recommendation_link. Marca solution_reference como deprecated.
A sétima leva faz os ajustes nas tabelas existentes (regional_penalties ganhando regiões novas, diagnostic_definition.trigger_factor_ids migrando para diagnostic_trigger, FKs adicionais em priority_score_audit).
A oitava leva, depois de tudo estável, remove solution_reference e diagnostic_definition.base_explanation_template.

1. Armadilhas a evitar
Não trate metric_evaluation como tabela append-only sem particionamento. Numa base com 10k usuários e 80 métricas por sessão, são 800k linhas por wave de uso. Particione por analysis_report_id (hash) ou por generated_at (range mensal) cedo — adicionar particionamento depois com dados reais é caro.
Não esqueça índice em (analysis_report_id, metric_id) em metric_evaluation. É a query mais frequente do frontend.
Não use FK para metric_id apenas em metric_definition da versão atual. Se o catálogo for versionado, a FK deve ser para (metric_id, version) ou usar um "definition snapshot". Caso contrário, deletar uma versão antiga quebra integridade.
Não confie em JSONB para listas que vão ser queryadas. trigger_factor_ids JSONB é OK para leitura completa, mas se precisar consultar "quais diagnósticos disparam para factor X?", JSONB com @> operator é lento. Tabela relacional ganha sempre.
Não permita escrever em metric_evaluation sem validar metric_id está no catálogo da versão correta. Constraint via trigger ou via aplicação. O custo de uma métrica órfã chegando ao banco é diagnóstico arruinado.
Não exponha score_0_100 global sem checar is_displayable. Já mencionado no plano, mas vale ecoar no DDL: global_score deveria ter um CHECK que impede score_0_100 IS NOT NULL AND is_displayable = FALSE.
Não esqueça da retenção em rendered_asset. Igual a photo_storage, deve ter expires_at e is_expired. Imagens anotadas com a foto do usuário são tão sensíveis quanto a foto bruta.
Não armazene o disclaimer_text_snapshot como FK para uma tabela mutável. Tem que ser TEXT congelado dentro de analysis_report. Disclaimers mudam por questão legal — análises antigas precisam preservar o que o usuário leu na época.