-- =============================================================
-- DDL PostgreSQL — versão enriquecida com comentários
-- Gerado a partir dos ERDs + planos técnicos
-- Módulos: Photo Quality (Mód. 0) | Diagnosis (Mód. 2) | Decision (Mód. 1)
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()


-- =============================================================
-- MÓDULO 0 — PHOTO QUALITY (gatekeeper do pipeline)
-- Decide se uma imagem é "analisável", calcula confiança realista,
-- garante consistência ao longo do tempo (before/after).
-- Arquitetura híbrida: cliente roda MediaPipe/WASM por padrão;
-- servidor faz fallback transparente.
-- =============================================================

-- ─────────────────────────────────────────────
-- Configuração de limiares (versionada, editável sem deploy)
-- ─────────────────────────────────────────────
CREATE TABLE quality_threshold_config (
    version             TEXT        PRIMARY KEY,
    max_yaw             FLOAT       NOT NULL,
    max_pitch           FLOAT       NOT NULL,
    max_roll            FLOAT       NOT NULL,
    min_sharpness       FLOAT       NOT NULL,
    grade_alta_min      FLOAT       NOT NULL,
    grade_media_min     FLOAT       NOT NULL,
    grade_baixa_min     FLOAT       NOT NULL,
    consistency_official_min FLOAT  NOT NULL,
    is_active           BOOLEAN     NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE quality_threshold_config IS
    'Limiares versionados do gatekeeper de qualidade. Apenas uma versão pode ter is_active=TRUE por vez. Permite calibrar sem deploy.';
COMMENT ON COLUMN quality_threshold_config.max_yaw IS
    'Rotação horizontal máxima absoluta (°). Sugerido: 8-10. Acima disso → foto rejeitada.';
COMMENT ON COLUMN quality_threshold_config.max_pitch IS
    'Inclinação vertical (cabeça pra cima/baixo) máxima absoluta (°). Sugerido: 8.';
COMMENT ON COLUMN quality_threshold_config.max_roll IS
    'Inclinação lateral máxima absoluta (°). Sugerido: 5.';
COMMENT ON COLUMN quality_threshold_config.min_sharpness IS
    'Limiar mínimo da métrica de blur (variance of Laplacian). Abaixo → recaptura obrigatória.';
COMMENT ON COLUMN quality_threshold_config.grade_alta_min IS
    'Score mínimo para grade ALTA. Padrão: 0.85.';
COMMENT ON COLUMN quality_threshold_config.grade_media_min IS
    'Score mínimo para grade MÉDIA. Padrão: 0.70.';
COMMENT ON COLUMN quality_threshold_config.grade_baixa_min IS
    'Score mínimo para grade BAIXA. Padrão: 0.55. Abaixo → REJEITADA.';
COMMENT ON COLUMN quality_threshold_config.consistency_official_min IS
    'ConsistencyScore mínimo para liberar "comparação oficial" (before/after). Padrão: 0.80.';


-- ─────────────────────────────────────────────
-- Grupos de baseline (mesmas condições de captura)
-- ─────────────────────────────────────────────
CREATE TABLE baseline_group (
    id                  TEXT        PRIMARY KEY,
    user_id             UUID        NOT NULL,
    beard               BOOLEAN     NOT NULL DEFAULT FALSE,
    expression          TEXT,
    lighting_profile    FLOAT,
    is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE baseline_group IS
    'Agrupa fotos do mesmo usuário sob mesmas condições (ex: "sem barba + neutro + luz frontal"). Comparações before/after só ocorrem dentro do mesmo grupo.';
COMMENT ON COLUMN baseline_group.id IS
    'Slug descritivo do grupo (ex: "no_beard__neutral__front_light"). Determinístico para permitir agrupamento automático.';
COMMENT ON COLUMN baseline_group.expression IS
    'Estado da expressão do grupo (ex: "neutral", "smile"). Comparações cruzadas entre expressões diferentes não são oficiais.';
COMMENT ON COLUMN baseline_group.lighting_profile IS
    'Perfil de iluminação numérico (assimetria + intensidade média). Usado para detectar divergência ao comparar fotos.';
COMMENT ON COLUMN baseline_group.is_active IS
    'FALSE quando o grupo foi descontinuado (ex: usuário raspou a barba e o grupo "com barba" virou histórico).';


-- ─────────────────────────────────────────────
-- Relatório principal de qualidade (1 por sessão de captura)
-- ─────────────────────────────────────────────
CREATE TABLE photo_quality_report (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID        NOT NULL,
    processing_mode     TEXT        NOT NULL,
    quality_score_final FLOAT       NOT NULL,
    quality_grade       TEXT        NOT NULL,
    pose_yaw            FLOAT       NOT NULL,
    pose_pitch          FLOAT       NOT NULL,
    pose_roll           FLOAT       NOT NULL,
    sharpness_score     FLOAT       NOT NULL,
    lighting_score      FLOAT       NOT NULL,
    occlusion_score     FLOAT       NOT NULL,
    expression_state    TEXT,
    pipeline_allowed    BOOLEAN     NOT NULL DEFAULT FALSE,
    comparison_allowed  BOOLEAN     NOT NULL DEFAULT FALSE,
    evaluated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE photo_quality_report IS
    'Veredicto consolidado do gatekeeper para uma sessão. Determina se o pipeline (métricas → fatores → diagnóstico) pode rodar.';
COMMENT ON COLUMN photo_quality_report.processing_mode IS
    'Onde landmarks/qualidade foram calculados: CLIENT_SIDE (browser via MediaPipe WASM, padrão) ou SERVER_FALLBACK (Python/FastAPI quando o cliente não suporta). Registrado para rastreabilidade — RF-PQ-H05.';
COMMENT ON COLUMN photo_quality_report.quality_score_final IS
    'Score multiplicativo final em [0,1]: FaceOK × PoseScore × SharpnessScore × LightingScore × OcclusionScore × ExpressionScore. Multiplicativo evita "compensar" blur ruim com luz boa.';
COMMENT ON COLUMN photo_quality_report.quality_grade IS
    'Classificação derivada do score: ALTA (≥0.85) | MEDIA (0.70-0.85) | BAIXA (0.55-0.70) | REJEITADA (<0.55 ou face incompleta/2+ rostos/blur severo/pose fora do limite).';
COMMENT ON COLUMN photo_quality_report.pose_yaw IS
    'Rotação horizontal em graus. Frontal neutro: |yaw| ≤ 8-10°.';
COMMENT ON COLUMN photo_quality_report.pose_pitch IS
    'Inclinação vertical em graus. Frontal neutro: |pitch| ≤ 8°.';
COMMENT ON COLUMN photo_quality_report.pose_roll IS
    'Inclinação lateral em graus. Frontal neutro: |roll| ≤ 5°.';
COMMENT ON COLUMN photo_quality_report.sharpness_score IS
    'Subscore de nitidez em [0,1] derivado de variance of Laplacian normalizada.';
COMMENT ON COLUMN photo_quality_report.lighting_score IS
    'Subscore de iluminação em [0,1]: combina exposição global e uniformidade esquerda/direita.';
COMMENT ON COLUMN photo_quality_report.occlusion_score IS
    'Subscore de oclusões em [0,1]: penaliza barba pesada, óculos, cabelo cobrindo, mão, máscara.';
COMMENT ON COLUMN photo_quality_report.expression_state IS
    'Estado capturado: "neutral" | "smile" | "open_mouth" | "eyes_closed". Análise estrutural exige neutro.';
COMMENT ON COLUMN photo_quality_report.pipeline_allowed IS
    'Se FALSE, o pipeline downstream (métricas → diagnóstico) NÃO roda. Disparado por grade REJEITADA.';
COMMENT ON COLUMN photo_quality_report.comparison_allowed IS
    'Se TRUE, foto pode ser usada em comparação oficial (before/after). Exige grade ALTA/MEDIA + ConsistencyScore ≥ 0.80.';


-- ─────────────────────────────────────────────
-- Payload de landmarks (contrato cliente-servidor)
-- ─────────────────────────────────────────────
CREATE TABLE landmark_payload (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id           UUID        NOT NULL REFERENCES photo_quality_report(id) ON DELETE CASCADE,
    landmarks_normalized JSONB      NOT NULL DEFAULT '{}',
    pose_yaw            FLOAT       NOT NULL,
    pose_pitch          FLOAT       NOT NULL,
    pose_roll           FLOAT       NOT NULL,
    quality_score       FLOAT       NOT NULL,
    beard               BOOLEAN     NOT NULL DEFAULT FALSE,
    beard_density       FLOAT,
    glasses             BOOLEAN     NOT NULL DEFAULT FALSE,
    smile               BOOLEAN     NOT NULL DEFAULT FALSE,
    fingerprint_hash    TEXT,
    processing_mode     TEXT        NOT NULL,
    captured_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (report_id)
);

COMMENT ON TABLE landmark_payload IS
    'Value object compartilhado cliente↔servidor. Carrega landmarks já calculados (cliente) ou os produzidos no fallback (servidor). É o input primário do pipeline — não a foto bruta. RF-PQ-H02.';
COMMENT ON COLUMN landmark_payload.landmarks_normalized IS
    'Array JSON com 468 pontos do MediaPipe Face Mesh, normalizados em coordenadas relativas à bounding box do rosto.';
COMMENT ON COLUMN landmark_payload.beard_density IS
    'Densidade aproximada de barba em [0,1]. NULL quando beard=FALSE. Usado em beardPenalty (afeta jaw/chin).';
COMMENT ON COLUMN landmark_payload.fingerprint_hash IS
    'Hash determinístico das condições de sessão (barba, expressão, iluminação, distância). Permite agrupar fotos comparáveis sem reprocessar tudo.';
COMMENT ON COLUMN landmark_payload.processing_mode IS
    'Onde este payload foi gerado: CLIENT_SIDE | SERVER_FALLBACK. Deve coincidir com photo_quality_report.processing_mode.';


-- ─────────────────────────────────────────────
-- Penalizações regionais (afetam confiança downstream por região)
-- ─────────────────────────────────────────────
CREATE TABLE regional_penalties (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id           UUID        NOT NULL REFERENCES photo_quality_report(id) ON DELETE CASCADE,
    jaw_penalty         FLOAT       NOT NULL DEFAULT 0,
    eye_penalty         FLOAT       NOT NULL DEFAULT 0,
    nose_penalty        FLOAT       NOT NULL DEFAULT 0,
    brow_penalty        FLOAT       NOT NULL DEFAULT 0,
    cheek_penalty       FLOAT       NOT NULL DEFAULT 0,
    UNIQUE (report_id)
);

COMMENT ON TABLE regional_penalties IS
    'Penalizações por região anatômica em [0,1]. Permite que olhos sigam confiáveis mesmo quando a barba mata a mandíbula — sem isso o sistema seria injustamente conservador.';
COMMENT ON COLUMN regional_penalties.jaw_penalty IS
    'Penalização da mandíbula/queixo. Cresce com beardPenalty e oclusões inferiores.';
COMMENT ON COLUMN regional_penalties.eye_penalty IS
    'Penalização da região dos olhos. Cresce com glassesPenalty e cabelo cobrindo.';
COMMENT ON COLUMN regional_penalties.nose_penalty IS
    'Penalização do nariz. Cresce com glassesPenalty (ponte nasal) e estouro de luz.';
COMMENT ON COLUMN regional_penalties.brow_penalty IS
    'Penalização das sobrancelhas/testa. Cresce com cabelo cobrindo e sombra forte.';
COMMENT ON COLUMN regional_penalties.cheek_penalty IS
    'Penalização das maçãs/bochechas. Cresce com sorriso (expressionPenalty) e iluminação assimétrica.';


-- ─────────────────────────────────────────────
-- Recomendação de recaptura (UX: 1 instrução por vez)
-- ─────────────────────────────────────────────
CREATE TABLE recapture_recommendation (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id           UUID        NOT NULL REFERENCES photo_quality_report(id) ON DELETE CASCADE,
    primary_reason      TEXT        NOT NULL,
    instruction         TEXT        NOT NULL,
    severity            FLOAT       NOT NULL,
    UNIQUE (report_id)
);

COMMENT ON TABLE recapture_recommendation IS
    'Sugestão única de correção mostrada ao usuário. Princípio de UX: no máximo 1 instrução por vez para reduzir abandono.';
COMMENT ON COLUMN recapture_recommendation.primary_reason IS
    'Categoria da falha mais grave: POSE | LIGHTING | SHARPNESS | OCCLUSION | EXPRESSION | DISTANCE.';
COMMENT ON COLUMN recapture_recommendation.instruction IS
    'Instrução curta para o usuário (ex: "Aproxime um pouco", "Mais luz", "Centralize", "Endireite a cabeça", "Expressão neutra").';
COMMENT ON COLUMN recapture_recommendation.severity IS
    'Gravidade da falha em [0,1]. Acima de 0.8 → foto bloqueada; entre 0.5-0.8 → degradada com aviso.';


-- ─────────────────────────────────────────────
-- Consistência longitudinal (faz before/after ser confiável)
-- ─────────────────────────────────────────────
CREATE TABLE consistency_report (
    id                      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id               UUID    NOT NULL REFERENCES photo_quality_report(id) ON DELETE CASCADE,
    baseline_session_id     UUID    NOT NULL,
    baseline_group_id       TEXT    NOT NULL REFERENCES baseline_group(id),
    score                   FLOAT   NOT NULL,
    is_official_comparison  BOOLEAN NOT NULL DEFAULT FALSE,
    diverged_factors        JSONB   NOT NULL DEFAULT '[]',
    UNIQUE (report_id)
);

COMMENT ON TABLE consistency_report IS
    'Comparação da foto atual contra um baseline válido. É o que distingue "achei que melhorou" de "melhorou de fato".';
COMMENT ON COLUMN consistency_report.baseline_session_id IS
    'Sessão de referência (foto anterior do mesmo grupo) usada como ponto de comparação.';
COMMENT ON COLUMN consistency_report.baseline_group_id IS
    'Grupo ao qual ambas as fotos pertencem. Comparações entre grupos diferentes nunca são oficiais.';
COMMENT ON COLUMN consistency_report.score IS
    'ConsistencyScore em [0,1]: alto = mesmas condições; médio = 1 mudança leve (ex: luz); baixo = barba/expressão/pose mudaram.';
COMMENT ON COLUMN consistency_report.is_official_comparison IS
    'TRUE somente quando score ≥ consistency_official_min E grade ALTA/MEDIA. Bloqueia "before/after oficial" quando FALSE.';
COMMENT ON COLUMN consistency_report.diverged_factors IS
    'Array dos fatores que mudaram em relação ao baseline (ex: ["beard","lighting","expression"]). Usado para explicar ao usuário por que a comparação não é oficial.';


-- ─────────────────────────────────────────────
-- Armazenamento de foto bruta (opt-in, com expiração)
-- ─────────────────────────────────────────────
CREATE TABLE photo_storage (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id           UUID        NOT NULL REFERENCES photo_quality_report(id) ON DELETE CASCADE,
    url                 TEXT        NOT NULL,
    user_consented      BOOLEAN     NOT NULL DEFAULT FALSE,
    purpose             TEXT        NOT NULL,
    expires_at          TIMESTAMPTZ,
    is_expired          BOOLEAN     NOT NULL DEFAULT FALSE,
    UNIQUE (report_id)
);

COMMENT ON TABLE photo_storage IS
    'Persistência da foto bruta. SEMPRE opt-in — RF-PQ-H03. Sem consentimento, apenas features (landmarks/scores) são armazenadas.';
COMMENT ON COLUMN photo_storage.user_consented IS
    'TRUE só após o usuário autorizar explicitamente. Pré-condição obrigatória para qualquer persistência. Política aplicada em PhotoStoragePolicy.shouldStore().';
COMMENT ON COLUMN photo_storage.purpose IS
    'Finalidade declarada: DEBUG | AUDIT | COMPARISON. Sem purpose definida, foto não é persistida.';
COMMENT ON COLUMN photo_storage.expires_at IS
    'Política de retenção configurável. Após esta data, foto deve ser purgada por job de limpeza.';
COMMENT ON COLUMN photo_storage.is_expired IS
    'TRUE quando a foto já foi efetivamente removida do storage. Mantém o registro para auditoria mesmo após o purge.';


-- =============================================================
-- MÓDULO 2 — DIAGNOSIS (linguagem humana a partir de fatores)
-- Recebe FactorResult[] + PhotoQualityContext e devolve
-- candidatos com nome, severidade, causa provável e explicação.
-- NÃO define prioridade (isso é Decision) nem prescreve ação.
-- =============================================================

-- ─────────────────────────────────────────────
-- Versionamento de definições (configurável sem deploy)
-- ─────────────────────────────────────────────
CREATE TABLE diagnostic_def_version (
    version     TEXT        PRIMARY KEY,
    is_active   BOOLEAN     NOT NULL DEFAULT FALSE,
    created_by  TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE diagnostic_def_version IS
    'Versão do catálogo de diagnósticos. Apenas uma is_active=TRUE por vez. Permite calibrar regras sem deploy — RF-DG11.';


-- ─────────────────────────────────────────────
-- Causas (catálogo reutilizável)
-- ─────────────────────────────────────────────
CREATE TABLE cause_definition (
    id          TEXT        PRIMARY KEY,
    description TEXT        NOT NULL,
    type        TEXT        NOT NULL,
    modificavel BOOLEAN     NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE cause_definition IS
    'Catálogo de causas prováveis reutilizadas entre diagnósticos. Mesma causa pode aparecer em múltiplos diagnósticos.';
COMMENT ON COLUMN cause_definition.type IS
    'Natureza da causa: HABITO | ESTRUTURAL | POSTURAL | TONUS | DENTARIO | EXTERNO.';
COMMENT ON COLUMN cause_definition.modificavel IS
    'TRUE se a causa é modificável sem especialista (ex: hábito mastigatório). FALSE para causas estruturais que exigem intervenção.';


-- ─────────────────────────────────────────────
-- Definições de diagnóstico (catálogo versionado)
-- ─────────────────────────────────────────────
CREATE TABLE diagnostic_definition (
    id                          TEXT    PRIMARY KEY,
    version                     TEXT    NOT NULL REFERENCES diagnostic_def_version(version),
    nome_display                TEXT    NOT NULL,
    slug                        TEXT    NOT NULL,
    category                    TEXT    NOT NULL,
    region                      TEXT,
    base_explanation_template   TEXT,
    trigger_factor_ids          JSONB   NOT NULL DEFAULT '[]'
);

CREATE INDEX idx_diagnostic_definition_version ON diagnostic_definition(version);

COMMENT ON TABLE diagnostic_definition IS
    'Definição estática de um diagnóstico. As regras (quais fatores disparam) ficam aqui — não em código.';
COMMENT ON COLUMN diagnostic_definition.nome_display IS
    'Nome humano exibido no card (ex: "Assimetria da mandíbula"). NÃO é jargão técnico.';
COMMENT ON COLUMN diagnostic_definition.category IS
    'Categoria primária: ESTRUTURAL | TONUS | POSTURA | PELE.';
COMMENT ON COLUMN diagnostic_definition.region IS
    'Região anatômica primária: olhos | sobrancelhas | mandibula | nariz | labios | bochechas | testa.';
COMMENT ON COLUMN diagnostic_definition.base_explanation_template IS
    'Template do texto simples com placeholders (ex: "Seu lado {dominant} trabalha mais na região {region}"). Interpolado com a severidade no buildSimple().';
COMMENT ON COLUMN diagnostic_definition.trigger_factor_ids IS
    'Array JSON dos IDs de FactorResult cuja presença (fora da norma) dispara este diagnóstico. Avaliado por DiagnosticGeneratorService.applyRules().';


-- ─────────────────────────────────────────────
-- Relatório (1 por sessão)
-- ─────────────────────────────────────────────
CREATE TABLE diagnostic_report (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID        NOT NULL,
    user_id             UUID        NOT NULL,
    definition_version  TEXT        NOT NULL REFERENCES diagnostic_def_version(version),
    generated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE diagnostic_report IS
    'Aggregate root do contexto Diagnosis. Encapsula todos os candidatos gerados na sessão — incluindo os de baixa confiança (filtragem é responsabilidade da camada Decision).';
COMMENT ON COLUMN diagnostic_report.definition_version IS
    'Versão do catálogo usada nesta sessão. Auditabilidade — RNF-DG04.';


-- ─────────────────────────────────────────────
-- Candidato (entidade central)
-- ─────────────────────────────────────────────
CREATE TABLE diagnostic_candidate (
    id                      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id               UUID    NOT NULL REFERENCES diagnostic_report(id) ON DELETE CASCADE,
    definition_id           TEXT    NOT NULL REFERENCES diagnostic_definition(id),
    category                TEXT    NOT NULL,
    region                  TEXT,
    severity                TEXT    NOT NULL,
    confidence              FLOAT   NOT NULL,
    requires_professional   BOOLEAN NOT NULL DEFAULT FALSE,
    blocks_display          BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_diagnostic_candidate_report ON diagnostic_candidate(report_id);

COMMENT ON TABLE diagnostic_candidate IS
    'Diagnóstico identificado para a sessão. Carrega tudo que a UI precisa para o card simples. Todos os candidatos são persistidos — inclusive baixa confiança — para auditoria e evolução.';
COMMENT ON COLUMN diagnostic_candidate.severity IS
    'LEVE (<1σ) | MODERADO (1-2σ) | SEVERO (>2σ). σ é a variância esperada da métrica.';
COMMENT ON COLUMN diagnostic_candidate.confidence IS
    'Confiança final em [0,1] já com penalização de qualidade aplicada. Label derivado: ALTA ≥0.75, MEDIA 0.50-0.74, BAIXA <0.50.';
COMMENT ON COLUMN diagnostic_candidate.requires_professional IS
    'TRUE quando severity=SEVERO. Dispara aviso "isso pode exigir avaliação profissional" no card.';
COMMENT ON COLUMN diagnostic_candidate.blocks_display IS
    'TRUE quando algum GuardrailFlag bloqueia exibição (tipicamente photo_quality_score < 0.4). Candidato fica armazenado mas não vai para a UI.';


-- ─────────────────────────────────────────────
-- Breakdown de confiança (rastreabilidade)
-- ─────────────────────────────────────────────
CREATE TABLE confidence_breakdown (
    id                      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id            UUID    NOT NULL REFERENCES diagnostic_candidate(id) ON DELETE CASCADE,
    factor_contributions    JSONB   NOT NULL DEFAULT '{}',
    raw_confidence          FLOAT   NOT NULL,
    photo_quality_penalty   FLOAT   NOT NULL DEFAULT 0,
    final_confidence        FLOAT   NOT NULL,
    UNIQUE (candidate_id)
);

COMMENT ON TABLE confidence_breakdown IS
    'Decomposição auditável da confiança do candidato. RNF-DG02: deve ser sempre rastreável quem contribuiu com quanto.';
COMMENT ON COLUMN confidence_breakdown.factor_contributions IS
    'Mapa JSON {factorId → {weight, contribution}} mostrando como cada fator entrou na média ponderada.';
COMMENT ON COLUMN confidence_breakdown.raw_confidence IS
    'Média ponderada das confianças dos fatores ANTES da penalização de foto.';
COMMENT ON COLUMN confidence_breakdown.photo_quality_penalty IS
    'Fator de penalização aplicado em [0,1]. final = raw × (1 - penalty). Nunca aumenta a confiança — só reduz.';
COMMENT ON COLUMN confidence_breakdown.final_confidence IS
    'Confiança final exposta ao candidato. Espelha diagnostic_candidate.confidence.';


-- ─────────────────────────────────────────────
-- Explicação (simples + avançada)
-- ─────────────────────────────────────────────
CREATE TABLE diagnostic_explanation (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id    UUID    NOT NULL REFERENCES diagnostic_candidate(id) ON DELETE CASCADE,
    simple_text     TEXT,
    what_not_to_do  TEXT,
    evidences       JSONB   NOT NULL DEFAULT '[]',
    adv_factor_ids  JSONB   NOT NULL DEFAULT '[]',
    adv_weights     JSONB   NOT NULL DEFAULT '[]',
    UNIQUE (candidate_id)
);

COMMENT ON TABLE diagnostic_explanation IS
    'Texto exibido para o usuário. Modo simples = humano e sem números; modo avançado = rastreável.';
COMMENT ON COLUMN diagnostic_explanation.simple_text IS
    'UMA frase em linguagem humana, sem números, sem coordenadas. Conecta medida à percepção (ex: "Diferença leve entre lados altera sua expressão").';
COMMENT ON COLUMN diagnostic_explanation.what_not_to_do IS
    'Uma linha indicando o que evitar (ex: "Não force exercícios mandibulares se sentir dor").';
COMMENT ON COLUMN diagnostic_explanation.evidences IS
    'Array JSON com 1-2 evidências curtas em linguagem humana (ex: ["Diferença visível na altura das sobrancelhas"]). Sem métricas brutas.';
COMMENT ON COLUMN diagnostic_explanation.adv_factor_ids IS
    'Modo avançado — IDs dos fatores que contribuíram. Exibido apenas via toggle "Ver detalhes".';
COMMENT ON COLUMN diagnostic_explanation.adv_weights IS
    'Modo avançado — pesos usados na média ponderada de confiança.';


-- ─────────────────────────────────────────────
-- Causas vinculadas
-- ─────────────────────────────────────────────
CREATE TABLE cause_link (
    id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id        UUID    NOT NULL REFERENCES diagnostic_candidate(id) ON DELETE CASCADE,
    cause_definition_id TEXT    NOT NULL REFERENCES cause_definition(id),
    modificavel         BOOLEAN NOT NULL DEFAULT FALSE,
    confidence          FLOAT   NOT NULL
);

COMMENT ON TABLE cause_link IS
    'N:N entre candidato e causas prováveis. Ordenado por confidence DESC pelo CauseLinkerService.';
COMMENT ON COLUMN cause_link.modificavel IS
    'Snapshot de cause_definition.modificavel no momento do diagnóstico (a definição pode mudar depois).';
COMMENT ON COLUMN cause_link.confidence IS
    'Probabilidade desta ser de fato a causa, dado o quadro. Independente da confiança do diagnóstico.';


-- ─────────────────────────────────────────────
-- Soluções referenciadas (sem detalhes — só ponteiros)
-- ─────────────────────────────────────────────
CREATE TABLE solution_reference (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id    UUID    NOT NULL REFERENCES diagnostic_candidate(id) ON DELETE CASCADE,
    slug            TEXT    NOT NULL,
    tipo            TEXT    NOT NULL,
    min_severity    TEXT
);

COMMENT ON TABLE solution_reference IS
    'Ponteiro para soluções catalogadas no módulo de execução. Diagnosis NÃO descreve nem prescreve — só referencia.';
COMMENT ON COLUMN solution_reference.tipo IS
    'NAO_INVASIVA (exercícios/hábitos) | INVASIVA (dental, fisio, cosmiatria) | NAO_SOLUCIONAVEL (encaminhar).';
COMMENT ON COLUMN solution_reference.min_severity IS
    'Severidade mínima a partir da qual esta solução é apropriada. Filtra por SeverityClassifierService no link().';


-- ─────────────────────────────────────────────
-- Guardrails do candidato
-- ─────────────────────────────────────────────
CREATE TABLE guardrail_flag (
    id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id        UUID    NOT NULL REFERENCES diagnostic_candidate(id) ON DELETE CASCADE,
    type                TEXT    NOT NULL,
    message             TEXT    NOT NULL,
    blocks_display      BOOLEAN NOT NULL DEFAULT FALSE,
    requires_referral   BOOLEAN NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE guardrail_flag IS
    'Anotações de segurança colocadas pelo DiagnosticGuardrailService. Um candidato pode ter múltiplas flags acumuladas.';
COMMENT ON COLUMN guardrail_flag.type IS
    'PHOTO_QUALITY (foto inadequada, blocks_display=TRUE) | NON_SOLVABLE (todas soluções nao_solucionavel) | SEVERE_GRADE (severity=SEVERO) | REDUNDANCY (fundido).';
COMMENT ON COLUMN guardrail_flag.requires_referral IS
    'TRUE quando type=NON_SOLVABLE — orienta encaminhamento para profissional adequado.';


-- =============================================================
-- MÓDULO 1 — DECISION (top 3 + plano + guardrails)
-- Recebe DiagnosticCandidate[] + PhotoQualityContext.
-- Devolve apenas: o que importa, por quê, e o que fazer agora.
-- Stateless e determinístico (RNF-D02).
-- =============================================================

-- ─────────────────────────────────────────────
-- Tabela de Impacto Visual (versionada, editorial inicialmente)
-- ─────────────────────────────────────────────
CREATE TABLE impact_table_version (
    version     TEXT        PRIMARY KEY,
    is_active   BOOLEAN     NOT NULL DEFAULT FALSE,
    created_by  TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE impact_table_version IS
    'Versão da tabela de Impacto Visual (I do PriorityScore). Apenas uma is_active=TRUE. Editável sem deploy — RF-D14.';


CREATE TABLE impact_table_entry (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    version         TEXT    NOT NULL REFERENCES impact_table_version(version),
    diagnostic_id   TEXT    NOT NULL,
    region          TEXT,
    base_impact     FLOAT   NOT NULL,
    mult_leve       FLOAT   NOT NULL DEFAULT 1,
    mult_moderado   FLOAT   NOT NULL DEFAULT 1,
    mult_severo     FLOAT   NOT NULL DEFAULT 1
);

CREATE INDEX idx_impact_table_entry_version ON impact_table_entry(version);

COMMENT ON TABLE impact_table_entry IS
    'Mapa diagnóstico → impacto visual percebido por terceiros, em [0,1]. Provisório no início (editorial), refinado depois com feedback explícito + engajamento + testes A/B.';
COMMENT ON COLUMN impact_table_entry.diagnostic_id IS
    'Referência ao diagnostic_definition.id. Não usa FK para permitir que a tabela de impacto evolua independente do catálogo de diagnósticos.';
COMMENT ON COLUMN impact_table_entry.region IS
    'Região do diagnóstico. Usada como chave alternativa em fallbacks (quando diagnostic_id ainda não tem entrada específica).';
COMMENT ON COLUMN impact_table_entry.base_impact IS
    'Impacto base em [0,1]. Ex: assimetria de sobrancelha = 0.85 (alta perceptibilidade); micro-assimetria de lábio = 0.4.';
COMMENT ON COLUMN impact_table_entry.mult_leve IS
    'Multiplicador para severidade LEVE. Padrão: 0.6.';
COMMENT ON COLUMN impact_table_entry.mult_moderado IS
    'Multiplicador para severidade MODERADO. Padrão: 1.0.';
COMMENT ON COLUMN impact_table_entry.mult_severo IS
    'Multiplicador para severidade SEVERO. Padrão: 1.2 (cap em 1.0 no I final). Aplicado por ImpactTableService.applyGradeMultiplier().';


-- ─────────────────────────────────────────────
-- Aggregate root da decisão
-- ─────────────────────────────────────────────
CREATE TABLE decision_output (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id              UUID        NOT NULL,
    user_id                 UUID        NOT NULL,
    status                  TEXT        NOT NULL,
    impact_table_version    TEXT        REFERENCES impact_table_version(version),
    processing_notes        TEXT,
    generated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE decision_output IS
    'Saída do DecisionOrchestrator para uma sessão. Única porta de saída do bounded context Decision.';
COMMENT ON COLUMN decision_output.status IS
    'COMPLETED (top 3 entregue) | DEGRADED (qualityScore 0.4-0.6, processado com aviso) | BLOCKED (qualityScore < 0.4, processamento interrompido) | COLLECTION_NEEDED (todas confianças baixas → pede mais foto).';
COMMENT ON COLUMN decision_output.impact_table_version IS
    'Versão da ImpactTable usada — obrigatório registrar para auditoria (RNF-D05). NULL apenas em status BLOCKED.';
COMMENT ON COLUMN decision_output.processing_notes IS
    'Observações em texto livre do pipeline (ex: "Comparação congelada por mudança de barba", "Foto degradada — confiança rebaixada").';


-- ─────────────────────────────────────────────
-- Prioridade ranqueada
-- ─────────────────────────────────────────────
CREATE TABLE priority (
    id                      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id             UUID    NOT NULL REFERENCES decision_output(id) ON DELETE CASCADE,
    diagnostic_candidate_id UUID    REFERENCES diagnostic_candidate(id),
    rank                    INT     NOT NULL,
    list_type               TEXT    NOT NULL,
    category                TEXT,
    final_score             FLOAT   NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_priority_decision ON priority(decision_id);

COMMENT ON TABLE priority IS
    'Prioridade ranqueada com score auditável e referência ao diagnóstico de origem.';
COMMENT ON COLUMN priority.diagnostic_candidate_id IS
    'Origem deste item. NULL apenas em prioridades sintéticas (raras, ex: "Refazer foto").';
COMMENT ON COLUMN priority.rank IS
    'Posição dentro da list_type (1-based). topPriorities permite no máximo 3 — RF-D12.';
COMMENT ON COLUMN priority.list_type IS
    'TOP (até 3 acionáveis) | OBSERVE (precisa mais evidência ou impacto médio) | IGNORE (não vale mexer).';
COMMENT ON COLUMN priority.category IS
    'Espelha PriorityCategory: FACA_AGORA | OBSERVE | NAO_VALE_MEXER. Calculado por CategorizationService.categorize().';
COMMENT ON COLUMN priority.final_score IS
    'Score final após penalização de qualidade. Espelha priority_score_audit.final_score para queries rápidas de ranking.';


-- ─────────────────────────────────────────────
-- Auditoria do score (todos os componentes)
-- ─────────────────────────────────────────────
CREATE TABLE priority_score_audit (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    priority_id     UUID    NOT NULL REFERENCES priority(id) ON DELETE CASCADE,
    "I"             FLOAT,
    "S"             FLOAT,
    "C"             FLOAT,
    "A"             FLOAT,
    "E"             FLOAT,
    "R"             FLOAT,
    raw_score       FLOAT   NOT NULL,
    penalized_score FLOAT   NOT NULL,
    final_score     FLOAT   NOT NULL,
    UNIQUE (priority_id)
);

COMMENT ON TABLE priority_score_audit IS
    'Decomposição completa do PriorityScore. RNF-D01: TODOS os componentes devem ser persistidos para auditoria. Fórmula: (I × S × C × A) × (1-R) × (1 - E×0.5).';
COMMENT ON COLUMN priority_score_audit."I" IS
    'Impacto Visual em [0,1]. Vem da impact_table_entry. "Quão perceptível para terceiros".';
COMMENT ON COLUMN priority_score_audit."S" IS
    'Severidade em [0,1]. Distância da norma normalizada via z-score/percentil.';
COMMENT ON COLUMN priority_score_audit."C" IS
    'Confiança em [0,1]. Probabilidade de o diagnóstico estar correto. Vem do candidato calibrado.';
COMMENT ON COLUMN priority_score_audit."A" IS
    'Modificabilidade (Action) em [0,1]. Quão modificável sem especialista. A=0 → guardrail "não solucionável com treino".';
COMMENT ON COLUMN priority_score_audit."E" IS
    'Esforço em [0,1]. Custo de execução (tempo/complexidade do protocolo).';
COMMENT ON COLUMN priority_score_audit."R" IS
    'Risco em [0,1]. Risco de PIORAR fazendo sozinho. R>0.7 → guardrail bloqueante.';
COMMENT ON COLUMN priority_score_audit.raw_score IS
    'Score antes de qualquer penalização de qualidade de foto.';
COMMENT ON COLUMN priority_score_audit.penalized_score IS
    'Score após PriorityScoringService.applyQualityPenalty(). Nunca maior que raw_score.';
COMMENT ON COLUMN priority_score_audit.final_score IS
    'Score final usado no ranking. Espelha priority.final_score.';


-- ─────────────────────────────────────────────
-- Explicação da prioridade (simples + avançada)
-- ─────────────────────────────────────────────
CREATE TABLE explanation (
    id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    priority_id         UUID    NOT NULL REFERENCES priority(id) ON DELETE CASCADE,
    what_is             TEXT,
    confidence_label    TEXT,
    what_not_to_do      TEXT,
    evidences           JSONB   NOT NULL DEFAULT '[]',
    adv_metric_ids      JSONB   NOT NULL DEFAULT '[]',
    adv_factor_ids      JSONB   NOT NULL DEFAULT '[]',
    adv_weights         JSONB   NOT NULL DEFAULT '[]',
    adv_error_intervals JSONB   NOT NULL DEFAULT '[]',
    UNIQUE (priority_id)
);

COMMENT ON TABLE explanation IS
    'Explicação exibida no card de prioridade. Modo simples (Feynman, honesto) + modo avançado (rastreável). Construído por ExplanationBuilderService.';
COMMENT ON COLUMN explanation.what_is IS
    'Uma frase descrevendo o problema em linguagem de impacto. Sem números, sem jargão técnico.';
COMMENT ON COLUMN explanation.confidence_label IS
    'HIGH (≥0.75) | MEDIUM (0.50-0.74) | LOW (<0.50). Resolvido por ExplanationBuilderService.resolveConfidenceLabel().';
COMMENT ON COLUMN explanation.what_not_to_do IS
    'Uma linha indicando o que NÃO fazer. Anti-besteira: gera alívio e proteção.';
COMMENT ON COLUMN explanation.evidences IS
    'Array JSON com 1-2 evidências em linguagem humana (ex: ["Sua linha interpupilar tende a inclinar levemente"]).';
COMMENT ON COLUMN explanation.adv_metric_ids IS
    'Modo avançado — IDs das métricas atômicas que entraram. Toggle "Ver detalhes".';
COMMENT ON COLUMN explanation.adv_factor_ids IS
    'Modo avançado — IDs dos fatores agregados.';
COMMENT ON COLUMN explanation.adv_weights IS
    'Modo avançado — pesos aplicados em cada métrica/fator.';
COMMENT ON COLUMN explanation.adv_error_intervals IS
    'Modo avançado — intervalos de erro (sigma) por métrica. Permite ao usuário entender quando uma "melhora" está dentro do ruído.';


-- ─────────────────────────────────────────────
-- Guardrails da decisão
-- ─────────────────────────────────────────────
CREATE TABLE guardrail (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id     UUID    NOT NULL REFERENCES decision_output(id) ON DELETE CASCADE,
    type            TEXT    NOT NULL,
    message         TEXT    NOT NULL,
    referral        TEXT,
    blocks_protocol BOOLEAN NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE guardrail IS
    'Regras de segurança aplicadas pelo GuardrailService. Anti-burrice da decisão: impede o sistema de prescrever algo arriscado.';
COMMENT ON COLUMN guardrail.type IS
    'RISK (R>0.7) | NON_MODIFIABLE (A=0, "não solucionável com treino") | PHOTO_QUALITY (qualityScore<0.6) | DENTAL_PATTERN (categoria dentária — limitar a hábitos/postura).';
COMMENT ON COLUMN guardrail.referral IS
    'Sugestão de encaminhamento quando aplicável (ex: "Considerar avaliação odontológica", "Avaliação de fisioterapia facial"). NULL quando o guardrail não exige terceiros.';
COMMENT ON COLUMN guardrail.blocks_protocol IS
    'Quando TRUE, impede a geração de protocolo executável downstream. Disparado por RISK, NON_MODIFIABLE e DENTAL_PATTERN agressivo.';


-- =============================================================
-- ÍNDICES ADICIONAIS (consultas frequentes)
-- =============================================================

CREATE INDEX idx_photo_quality_report_session   ON photo_quality_report(session_id);
CREATE INDEX idx_diagnostic_report_session      ON diagnostic_report(session_id);
CREATE INDEX idx_diagnostic_report_user         ON diagnostic_report(user_id);
CREATE INDEX idx_decision_output_session        ON decision_output(session_id);
CREATE INDEX idx_decision_output_user           ON decision_output(user_id);
CREATE INDEX idx_baseline_group_user            ON baseline_group(user_id);
CREATE INDEX idx_cause_link_candidate           ON cause_link(candidate_id);
CREATE INDEX idx_solution_reference_candidate   ON solution_reference(candidate_id);