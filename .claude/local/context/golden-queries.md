---
tenant_id: "face-before-after"
project: "face-before-after"
module: "queries"
file_path: ".claude/local/context/golden-queries.md"
doc_type: "reference"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Non-trivial queries extracted from Nest services. 479 hits across 364 entities.
tags:
  - "queries"
  - "golden"
  - "harvest"
rag_keywords:
  - "queries"
  - "typeorm"
  - "sql"
  - "nest"
related_modules: []
depends_on:
  - "business_logic_map"
used_by:
  - "golden-queries-enricher"
---

# Golden Queries (raw) — face-before-after

> Pós-processar com a skill global `golden-queries-enricher` para gerar versões por módulo.

## `
      INSERT INTO recommendation_trigger (id, recommendation_id, metric_id, severity, direction, additional_conditions)
      VALUES
        (gen_random_uuid(), ` (11)

- [rawSql] `nest/src/database/migrations/1746000210000-M43RecommendationCatalogSeed.ts:359`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000210000-M43RecommendationCatalogSeed.ts:400`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000210000-M43RecommendationCatalogSeed.ts:423`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000210000-M43RecommendationCatalogSeed.ts:444`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000210000-M43RecommendationCatalogSeed.ts:470`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000210000-M43RecommendationCatalogSeed.ts:497`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000210000-M43RecommendationCatalogSeed.ts:527`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000210000-M43RecommendationCatalogSeed.ts:560`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000210000-M43RecommendationCatalogSeed.ts:595`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000210000-M43RecommendationCatalogSeed.ts:623`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000210000-M43RecommendationCatalogSeed.ts:641`
  ```ts
  await queryRunner.query(`
  ```

## `
      INSERT INTO diagnostic_template (version, metric_id, severity, direction, size, template_pt, placeholders_used) VALUES
        (` (11)

- [rawSql] `nest/src/database/migrations/1746000220000-M42DiagnosticTemplatesV1.ts:102`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000220000-M42DiagnosticTemplatesV1.ts:158`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000220000-M42DiagnosticTemplatesV1.ts:194`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000220000-M42DiagnosticTemplatesV1.ts:260`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000220000-M42DiagnosticTemplatesV1.ts:326`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000220000-M42DiagnosticTemplatesV1.ts:392`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000220000-M42DiagnosticTemplatesV1.ts:468`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000220000-M42DiagnosticTemplatesV1.ts:544`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000220000-M42DiagnosticTemplatesV1.ts:610`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000220000-M42DiagnosticTemplatesV1.ts:666`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000220000-M42DiagnosticTemplatesV1.ts:702`
  ```ts
  await queryRunner.query(`
  ```

## `DELETE FROM metric_definition WHERE version = ` (9)

- [rawSql] `nest/src/database/migrations/1746000040000-SeedMetricCatalogV1.ts:704`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000060000-SeedJawFamily.ts:336`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000070000-SeedNoseFamily.ts:348`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000080000-SeedMouthFamily.ts:355`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000090000-SeedBrowFamily.ts:394`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000100000-SeedCheekbonesFamily.ts:301`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000110000-SeedForeheadFamily.ts:269`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000120000-SeedGlobalShapeFamily.ts:273`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000130000-SeedPhiGoldenFamily.ts:175`
  ```ts
  await queryRunner.query(
  ```

## `INSERT INTO region_metric_weight (version, region, metric_id, weight)
           VALUES ($1, ` (9)

- [rawSql] `nest/src/database/migrations/1746000050000-RegionalAndGlobalScoring.ts:227`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000050000-RegionalAndGlobalScoring.ts:235`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000060000-SeedJawFamily.ts:316`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000070000-SeedNoseFamily.ts:328`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000080000-SeedMouthFamily.ts:335`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000090000-SeedBrowFamily.ts:374`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000100000-SeedCheekbonesFamily.ts:279`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000110000-SeedForeheadFamily.ts:245`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000120000-SeedGlobalShapeFamily.ts:249`
  ```ts
  await queryRunner.query(
  ```

## `DELETE FROM metric_ideal WHERE ideals_version = ` (8)

- [rawSql] `nest/src/database/migrations/1746000040000-SeedMetricCatalogV1.ts:697`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000060000-SeedJawFamily.ts:332`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000070000-SeedNoseFamily.ts:344`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000080000-SeedMouthFamily.ts:351`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000090000-SeedBrowFamily.ts:390`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000100000-SeedCheekbonesFamily.ts:297`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000110000-SeedForeheadFamily.ts:264`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000120000-SeedGlobalShapeFamily.ts:268`
  ```ts
  await queryRunner.query(
  ```

## `DELETE FROM region_metric_weight WHERE version = ` (7)

- [rawSql] `nest/src/database/migrations/1746000060000-SeedJawFamily.ts:328`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000070000-SeedNoseFamily.ts:340`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000080000-SeedMouthFamily.ts:347`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000090000-SeedBrowFamily.ts:386`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000100000-SeedCheekbonesFamily.ts:293`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000110000-SeedForeheadFamily.ts:258`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000120000-SeedGlobalShapeFamily.ts:262`
  ```ts
  await queryRunner.query(
  ```

## `
      INSERT INTO overlay_definition (
        overlay_id, version, display_name, description, category,
        default_visible, z_order, legend_text, is_decorative, rendering_hints
      ) VALUES (
        ` (7)

- [rawSql] `nest/src/database/migrations/1746000160000-M3OverlayCatalog.ts:253`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000160000-M3OverlayCatalog.ts:272`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000160000-M3OverlayCatalog.ts:291`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000160000-M3OverlayCatalog.ts:310`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000160000-M3OverlayCatalog.ts:329`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000190000-M33HeatmapOverlays.ts:39`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000190000-M33HeatmapOverlays.ts:60`
  ```ts
  await queryRunner.query(`
  ```

## `
      INSERT INTO recommendation_catalog
        (id, version, category, display_text_short_pt, display_text_long_pt,
         priority_default, effort_estimate, risk_level, requires_professional,
         professional_type, created_at)
      VALUES
        (` (6)

- [rawSql] `nest/src/database/migrations/1746000210000-M43RecommendationCatalogSeed.ts:62`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000210000-M43RecommendationCatalogSeed.ts:117`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000210000-M43RecommendationCatalogSeed.ts:152`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000210000-M43RecommendationCatalogSeed.ts:197`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000210000-M43RecommendationCatalogSeed.ts:264`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000210000-M43RecommendationCatalogSeed.ts:335`
  ```ts
  await queryRunner.query(`
  ```

## `reportRepo` (5)

- [repository] `nest/src/modules/analysis/domain/report-reader.service.ts:83`
  ```ts
  const report = await this.reportRepo.findOne({ where: { id } });
  ```
- [repository] `nest/src/modules/analysis/domain/report-reader.service.ts:96`
  ```ts
  const reports = await this.reportRepo.find({
  ```
- [repository] `nest/src/modules/diagnosis/narrative.service.ts:165`
  ```ts
  const report = await this.reportRepo.findOne({
  ```
- [repository] `nest/src/modules/diagnosis/narrative.service.ts:304`
  ```ts
  const report = await this.reportRepo.findOne({ where: { id: reportId } });
  ```
- [repository] `nest/src/modules/diagnosis/pdf.service.ts:62`
  ```ts
  const report = await this.reportRepo.findOne({ where: { id: reportId } });
  ```

## `evalRepo` (5)

- [repository] `nest/src/modules/analysis/domain/report-reader.service.ts:117`
  ```ts
  this.evalRepo.find({
  ```
- [repository] `nest/src/modules/diagnosis/diagnostic-priority.service.ts:211`
  ```ts
  ? await this.evalRepo.find({ where: { id: In(allEvalIds) } })
  ```
- [repository] `nest/src/modules/diagnosis/narrative.service.ts:181`
  ```ts
  const evaluations = await this.evalRepo.find({
  ```
- [repository] `nest/src/modules/diagnosis/narrative.service.ts:310`
  ```ts
  const evaluations = await this.evalRepo.find({
  ```
- [repository] `nest/src/modules/diagnosis/recommendation-engine.service.ts:177`
  ```ts
  const evaluations = await this.evalRepo.find({
  ```

## `
        INSERT INTO overlay_metric_dependency (
          overlay_id, overlay_version, metric_id, metric_definition_version,
          is_critical, notes
        ) VALUES (
          ` (4)

- [rawSql] `nest/src/database/migrations/1746000160000-M3OverlayCatalog.ts:382`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000160000-M3OverlayCatalog.ts:402`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000190000-M33HeatmapOverlays.ts:82`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000190000-M33HeatmapOverlays.ts:118`
  ```ts
  await queryRunner.query(`
  ```

## `t` (4)

- [queryBuilder] `nest/src/modules/admin/admin-blacklist.service.ts:32`
  ```ts
  let q = this.termRepo.createQueryBuilder('t');
  ```
- [queryBuilder] `nest/src/modules/diagnosis/diagnosis.service.ts:129`
  ```ts
  let query = this.templateRepository.createQueryBuilder('t');
  ```
- [queryBuilder] `nest/src/modules/diagnosis/diagnosis.service.ts:155`
  ```ts
  .createQueryBuilder('t')
  ```
- [queryBuilder] `nest/src/modules/diagnosis/recommendation-engine.service.ts:141`
  ```ts
  .createQueryBuilder('t')
  ```

## `
      INSERT INTO overlay_metric_dependency (
        overlay_id, overlay_version, metric_id, metric_definition_version,
        is_critical, notes
      ) VALUES (
        ` (3)

- [rawSql] `nest/src/database/migrations/1746000160000-M3OverlayCatalog.ts:357`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000160000-M3OverlayCatalog.ts:369`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000160000-M3OverlayCatalog.ts:415`
  ```ts
  await queryRunner.query(`
  ```

## `
          INSERT INTO recommendation_catalog (
            id, version, category, display_text_short_pt, display_text_long_pt,
            priority_default, effort_estimate, risk_level, requires_professional, professional_type,
            invasiveness_level, evidence_level, clinical_pathway_required, references_jsonb, disclaimer_template
          ) VALUES (
            $1, ` (3)

- [rawSql] `nest/src/database/migrations/1746000235000-M44SeedExerciseCatalog.ts:401`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000240000-M44SeedFullCatalog100.ts:1582`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000245000-M44SeedFullCatalog270.ts:715`
  ```ts
  await queryRunner.query(
  ```

## `
              INSERT INTO recommendation_trigger (
                recommendation_id, metric_id, severity, direction,
                additional_conditions, min_invasiveness_level, clinical_pathway_required
              ) VALUES ($1, $2, $3::severity_5_enum, ` (3)

- [rawSql] `nest/src/database/migrations/1746000235000-M44SeedExerciseCatalog.ts:421`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000240000-M44SeedFullCatalog100.ts:1616`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000245000-M44SeedFullCatalog270.ts:740`
  ```ts
  await queryRunner.query(
  ```

## `DELETE FROM recommendation_trigger WHERE recommendation_id = ANY($1::text[])` (3)

- [rawSql] `nest/src/database/migrations/1746000235000-M44SeedExerciseCatalog.ts:438`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000240000-M44SeedFullCatalog100.ts:1633`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000245000-M44SeedFullCatalog270.ts:757`
  ```ts
  await queryRunner.query(
  ```

## `DELETE FROM recommendation_catalog WHERE id = ANY($1::text[])` (3)

- [rawSql] `nest/src/database/migrations/1746000235000-M44SeedExerciseCatalog.ts:442`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000240000-M44SeedFullCatalog100.ts:1637`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000245000-M44SeedFullCatalog270.ts:761`
  ```ts
  await queryRunner.query(
  ```

## `
      ALTER TABLE recommendation_catalog
        DROP CONSTRAINT IF EXISTS chk_rec_animation_config_schema
    ` (3)

- [rawSql] `nest/src/database/migrations/1746000250000-M44AnimationConfig.ts:81`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000265000-M64RecordedTimeline.ts:21`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000265000-M64RecordedTimeline.ts:49`
  ```ts
  await queryRunner.query(`
  ```

## `INSERT INTO region_metric_weight (version, region, metric_id, weight)
           VALUES (` (3)

- [rawSql] `nest/src/database/migrations/1746000300000-SeedMetricsWaveC1.ts:438`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000310000-SeedMetricsWaveC2.ts:466`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000320000-SeedMetricsWaveC3.ts:465`
  ```ts
  await queryRunner.query(
  ```

## `DELETE FROM region_metric_weight
           WHERE version = ` (3)

- [rawSql] `nest/src/database/migrations/1746000300000-SeedMetricsWaveC1.ts:452`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000310000-SeedMetricsWaveC2.ts:480`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000320000-SeedMetricsWaveC3.ts:478`
  ```ts
  await queryRunner.query(
  ```

## `DELETE FROM metric_ideal
           WHERE ideals_version = ` (3)

- [rawSql] `nest/src/database/migrations/1746000300000-SeedMetricsWaveC1.ts:468`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000310000-SeedMetricsWaveC2.ts:489`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000320000-SeedMetricsWaveC3.ts:483`
  ```ts
  await queryRunner.query(
  ```

## `DELETE FROM metric_definition
           WHERE version = ` (3)

- [rawSql] `nest/src/database/migrations/1746000300000-SeedMetricsWaveC1.ts:501`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000310000-SeedMetricsWaveC2.ts:498`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000320000-SeedMetricsWaveC3.ts:488`
  ```ts
  await queryRunner.query(
  ```

## `landmarkRepo` (3)

- [repository] `nest/src/modules/analysis/domain/report-reader.service.ts:123`
  ```ts
  this.landmarkRepo.findOne({
  ```
- [repository] `nest/src/modules/overlays/overlays.service.ts:72`
  ```ts
  const lp = await this.landmarkRepo.findOne({
  ```
- [repository] `nest/src/modules/overlays/overlays.service.ts:210`
  ```ts
  const lp = await this.landmarkRepo.findOne({
  ```

## `ai` (3)

- [queryBuilder] `nest/src/modules/diagnosis/narrative.service.ts:193`
  ```ts
  .createQueryBuilder('ai')
  ```
- [queryBuilder] `nest/src/modules/diagnosis/narrative.service.ts:319`
  ```ts
  .createQueryBuilder('ai')
  ```
- [queryBuilder] `nest/src/modules/diagnosis/recommendation-engine.service.ts:195`
  ```ts
  .createQueryBuilder('ai')
  ```

## `
      INSERT INTO diagnostic_template_version (version, is_active, notes)
      VALUES (
        ` (2)

- [rawSql] `nest/src/database/migrations/1746000180000-M41DiagnosticTemplates.ts:192`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000220000-M42DiagnosticTemplatesV1.ts:87`
  ```ts
  await queryRunner.query(`
  ```

## `
      INSERT INTO template_blacklist_version (version, is_active, notes)
      VALUES (
        ` (2)

- [rawSql] `nest/src/database/migrations/1746000180000-M41DiagnosticTemplates.ts:241`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000260000-M42cTemplateBlacklistExtensionV02.ts:49`
  ```ts
  await queryRunner.query(`
  ```

## `
      INSERT INTO template_blacklist_term (version, term, category, notes)
      VALUES
        (` (2)

- [rawSql] `nest/src/database/migrations/1746000180000-M41DiagnosticTemplates.ts:251`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000260000-M42cTemplateBlacklistExtensionV02.ts:60`
  ```ts
  await queryRunner.query(`
  ```

## `DELETE FROM diagnostic_template WHERE version = ` (2)

- [rawSql] `nest/src/database/migrations/1746000220000-M42DiagnosticTemplatesV1.ts:97`
  ```ts
  await queryRunner.query(`DELETE FROM diagnostic_template WHERE version = 'v0.1'`);
  ```
- [rawSql] `nest/src/database/migrations/1746000220000-M42DiagnosticTemplatesV1.ts:728`
  ```ts
  await queryRunner.query(`DELETE FROM diagnostic_template WHERE version = 'v1.0'`);
  ```

## `ALTER TYPE recommendation_category_enum ADD VALUE IF NOT EXISTS ` (2)

- [rawSql] `nest/src/database/migrations/1746000225000-M44LadderEnumValues.ts:20`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000225000-M44LadderEnumValues.ts:23`
  ```ts
  await queryRunner.query(
  ```

## `
      ALTER TABLE recommendation_catalog
        ADD CONSTRAINT chk_rec_professional_type
        CHECK (professional_type IS NULL OR professional_type IN (
          ` (2)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:143`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:260`
  ```ts
  await queryRunner.query(`
  ```

## `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = ` (2)

- [rawSql] `nest/src/database/migrations/1746000250000-M44AnimationConfig.ts:46`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000270000-M44BiometricConfig.ts:34`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE recommendation_catalog
        ADD CONSTRAINT chk_rec_animation_config_schema
        CHECK (
          animation_config IS NULL
          OR (
            (animation_config->>` (2)

- [rawSql] `nest/src/database/migrations/1746000265000-M64RecordedTimeline.ts:27`
  ```ts
  await queryRunner.query(`
  ```
- [rawSql] `nest/src/database/migrations/1746000265000-M64RecordedTimeline.ts:54`
  ```ts
  await queryRunner.query(`
  ```

## `
        INSERT INTO metric_content
          (metric_id, locale, feynman_text, description, how_measured,
           ranges_text, common_issues, ` (2)

- [rawSql] `nest/src/database/migrations/1746000400000-MetricContent.ts:429`
  ```ts
  await queryRunner.query(
  ```
- [rawSql] `nest/src/database/migrations/1746000450000-M66bMetricContentBackfill.ts:90`
  ```ts
  await queryRunner.query(
  ```

## `UPDATE ideals_version SET is_active = true WHERE version = $1` (2)

- [rawSql] `nest/src/database/migrations/1746000460000-M67RecalibrateMetricIdeals.ts:163`
  ```ts
  await queryRunner.query(`UPDATE ideals_version SET is_active = true WHERE version = $1`, [NEW_VERSION]);
  ```
- [rawSql] `nest/src/database/migrations/1746000460000-M67RecalibrateMetricIdeals.ts:169`
  ```ts
  await queryRunner.query(`UPDATE ideals_version SET is_active = true WHERE version = $1`, [BASE_VERSION]);
  ```

## `termRepo` (2)

- [repository] `nest/src/modules/admin/admin-blacklist.service.ts:54`
  ```ts
  const item = await this.termRepo.findOne({ where: { id } });
  ```
- [repository] `nest/src/modules/admin/admin-blacklist.service.ts:64`
  ```ts
  const item = await this.termRepo.findOne({ where: { id } });
  ```

## `g` (2)

- [queryBuilder] `nest/src/modules/admin/admin-global-weights.service.ts:15`
  ```ts
  .createQueryBuilder('g')
  ```
- [queryBuilder] `nest/src/modules/admin/admin-global-weights.service.ts:23`
  ```ts
  let q = this.repo.createQueryBuilder('g');
  ```

## `m` (2)

- [queryBuilder] `nest/src/modules/admin/admin-metric-ideal.service.ts:16`
  ```ts
  .createQueryBuilder('m')
  ```
- [queryBuilder] `nest/src/modules/admin/admin-metric-ideal.service.ts:24`
  ```ts
  let q = this.repo.createQueryBuilder('m');
  ```

## `definitionRepo` (2)

- [repository] `nest/src/modules/analysis/domain/report-reader.service.ts:254`
  ```ts
  ? await this.definitionRepo.find({
  ```
- [repository] `nest/src/modules/analysis/domain/report-reader.service.ts:257`
  ```ts
  : await this.definitionRepo.find({
  ```

## `linkRepo` (2)

- [repository] `nest/src/modules/diagnosis/diagnostic-priority.service.ts:187`
  ```ts
  const links = await this.linkRepo.find({
  ```
- [repository] `nest/src/modules/diagnosis/narrative.service.ts:387`
  ```ts
  const links = await this.linkRepo.find({
  ```

## `assetRepo` (2)

- [repository] `nest/src/modules/diagnosis/pdf.service.ts:73`
  ```ts
  const existingAssets = await this.assetRepo.find({
  ```
- [repository] `nest/src/modules/overlays/overlays.service.ts:314`
  ```ts
  return this.assetRepo.find({
  ```

## `r` (2)

- [queryBuilder] `nest/src/modules/diagnosis/recommendation-catalog.service.ts:94`
  ```ts
  let query = this.catalogRepository.createQueryBuilder('r');
  ```
- [queryBuilder] `nest/src/modules/diagnosis/recommendation-catalog.service.ts:134`
  ```ts
  .createQueryBuilder('r')
  ```

## `CREATE EXTENSION IF NOT EXISTS ` (1)

- [rawSql] `nest/src/database/migrations/1746000000000-Extensions.ts:13`
  ```ts
  await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
  ```

## `
      CREATE TYPE metric_unit_enum AS ENUM (
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000010000-Catalogs.ts:28`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE TYPE metric_region_enum AS ENUM (
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000010000-Catalogs.ts:40`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE TYPE ideal_type_enum AS ENUM (
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000010000-Catalogs.ts:57`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE TABLE metric_registry_version (
        version       TEXT PRIMARY KEY,
        description   TEXT,
        is_active     BOOLEAN NOT NULL DEFAULT FALSE,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000010000-Catalogs.ts:66`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE UNIQUE INDEX uq_metric_registry_version_active
        ON metric_registry_version (is_active)
        WHERE is_active = TRUE
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000010000-Catalogs.ts:74`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON TABLE metric_registry_version IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000010000-Catalogs.ts:79`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE INDEX idx_metric_definition_version ON metric_definition(version)
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000010000-Catalogs.ts:102`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE INDEX idx_metric_definition_region ON metric_definition(region)
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000010000-Catalogs.ts:105`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN metric_definition.display_name IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000010000-Catalogs.ts:108`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN metric_definition.dependency_landmarks IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000010000-Catalogs.ts:112`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN metric_definition.presentation_only IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000010000-Catalogs.ts:116`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE TABLE ideals_version (
        version       TEXT PRIMARY KEY,
        description   TEXT,
        is_active     BOOLEAN NOT NULL DEFAULT FALSE,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000010000-Catalogs.ts:122`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE UNIQUE INDEX uq_ideals_version_active
        ON ideals_version (is_active)
        WHERE is_active = TRUE
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000010000-Catalogs.ts:130`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE INDEX idx_metric_ideal_version ON metric_ideal(ideals_version)
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000010000-Catalogs.ts:158`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN metric_ideal.direction_label_above IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000010000-Catalogs.ts:161`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE UNIQUE INDEX uq_analysis_threshold_config_active
        ON analysis_threshold_config (is_active)
        WHERE is_active = TRUE
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000010000-Catalogs.ts:182`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN analysis_threshold_config.disclaimer_text_snapshot IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000010000-Catalogs.ts:187`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE TABLE severity_collapse_policy (
        version       TEXT PRIMARY KEY,
        mapping       JSONB NOT NULL,
        is_active     BOOLEAN NOT NULL DEFAULT FALSE,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000010000-Catalogs.ts:196`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE UNIQUE INDEX uq_severity_collapse_policy_active
        ON severity_collapse_policy (is_active)
        WHERE is_active = TRUE
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000010000-Catalogs.ts:204`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN severity_collapse_policy.mapping IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000010000-Catalogs.ts:209`
  ```ts
  await queryRunner.query(`
  ```

## `DROP TABLE IF EXISTS severity_collapse_policy` (1)

- [rawSql] `nest/src/database/migrations/1746000010000-Catalogs.ts:216`
  ```ts
  await queryRunner.query(`DROP TABLE IF EXISTS severity_collapse_policy`);
  ```

## `DROP TABLE IF EXISTS analysis_threshold_config` (1)

- [rawSql] `nest/src/database/migrations/1746000010000-Catalogs.ts:217`
  ```ts
  await queryRunner.query(`DROP TABLE IF EXISTS analysis_threshold_config`);
  ```

## `DROP TABLE IF EXISTS metric_ideal` (1)

- [rawSql] `nest/src/database/migrations/1746000010000-Catalogs.ts:218`
  ```ts
  await queryRunner.query(`DROP TABLE IF EXISTS metric_ideal`);
  ```

## `DROP TABLE IF EXISTS ideals_version` (1)

- [rawSql] `nest/src/database/migrations/1746000010000-Catalogs.ts:219`
  ```ts
  await queryRunner.query(`DROP TABLE IF EXISTS ideals_version`);
  ```

## `DROP TABLE IF EXISTS metric_definition` (1)

- [rawSql] `nest/src/database/migrations/1746000010000-Catalogs.ts:220`
  ```ts
  await queryRunner.query(`DROP TABLE IF EXISTS metric_definition`);
  ```

## `DROP TABLE IF EXISTS metric_registry_version` (1)

- [rawSql] `nest/src/database/migrations/1746000010000-Catalogs.ts:221`
  ```ts
  await queryRunner.query(`DROP TABLE IF EXISTS metric_registry_version`);
  ```

## `DROP TYPE IF EXISTS ideal_type_enum` (1)

- [rawSql] `nest/src/database/migrations/1746000010000-Catalogs.ts:222`
  ```ts
  await queryRunner.query(`DROP TYPE IF EXISTS ideal_type_enum`);
  ```

## `DROP TYPE IF EXISTS metric_region_enum` (1)

- [rawSql] `nest/src/database/migrations/1746000010000-Catalogs.ts:223`
  ```ts
  await queryRunner.query(`DROP TYPE IF EXISTS metric_region_enum`);
  ```

## `DROP TYPE IF EXISTS metric_unit_enum` (1)

- [rawSql] `nest/src/database/migrations/1746000010000-Catalogs.ts:224`
  ```ts
  await queryRunner.query(`DROP TYPE IF EXISTS metric_unit_enum`);
  ```

## `INSERT INTO metric_registry_version (version, description, is_active)
       VALUES ($1, $2, TRUE)
       ON CONFLICT (version) DO NOTHING` (1)

- [rawSql] `nest/src/database/migrations/1746000020000-SeedInitialCatalogs.ts:39`
  ```ts
  await queryRunner.query(
  ```

## `INSERT INTO ideals_version (version, description, is_active)
       VALUES ($1, $2, TRUE)
       ON CONFLICT (version) DO NOTHING` (1)

- [rawSql] `nest/src/database/migrations/1746000020000-SeedInitialCatalogs.ts:46`
  ```ts
  await queryRunner.query(
  ```

## `INSERT INTO analysis_threshold_config (
         version,
         min_confidence_to_display_metric,
         min_confidence_to_show_global_score,
         score_band_no_number_max,
         score_band_refine_max,
         score_band_good_max,
         disclaimer_text_snapshot,
         is_active
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
       ON CONFLICT (version) DO NOTHING` (1)

- [rawSql] `nest/src/database/migrations/1746000020000-SeedInitialCatalogs.ts:53`
  ```ts
  await queryRunner.query(
  ```

## `INSERT INTO severity_collapse_policy (version, mapping, is_active)
       VALUES ($1, $2::jsonb, TRUE)
       ON CONFLICT (version) DO NOTHING` (1)

- [rawSql] `nest/src/database/migrations/1746000020000-SeedInitialCatalogs.ts:68`
  ```ts
  await queryRunner.query(
  ```

## `DELETE FROM severity_collapse_policy WHERE version = ` (1)

- [rawSql] `nest/src/database/migrations/1746000020000-SeedInitialCatalogs.ts:77`
  ```ts
  await queryRunner.query(`DELETE FROM severity_collapse_policy WHERE version = 'v1.0'`);
  ```

## `DELETE FROM analysis_threshold_config WHERE version = ` (1)

- [rawSql] `nest/src/database/migrations/1746000020000-SeedInitialCatalogs.ts:78`
  ```ts
  await queryRunner.query(`DELETE FROM analysis_threshold_config WHERE version = 'v1.0'`);
  ```

## `DELETE FROM ideals_version WHERE version = ` (1)

- [rawSql] `nest/src/database/migrations/1746000020000-SeedInitialCatalogs.ts:79`
  ```ts
  await queryRunner.query(`DELETE FROM ideals_version WHERE version = 'v1.0'`);
  ```

## `DELETE FROM metric_registry_version WHERE version = ` (1)

- [rawSql] `nest/src/database/migrations/1746000020000-SeedInitialCatalogs.ts:80`
  ```ts
  await queryRunner.query(`DELETE FROM metric_registry_version WHERE version = 'v1.0'`);
  ```

## `
      CREATE TYPE severity_5_enum AS ENUM (
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:32`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE TYPE severity_3_enum AS ENUM (
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:42`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE TABLE analysis_report (
        id                          UUID NOT NULL DEFAULT gen_random_uuid(),
        session_id                  TEXT NOT NULL,
        photo_reference             TEXT,
        normalization_basis         TEXT NOT NULL DEFAULT ` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:54`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE INDEX idx_analysis_report_id ON analysis_report (id)
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:79`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE INDEX idx_analysis_report_session ON analysis_report (session_id)
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:82`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE TABLE analysis_report_2026_05
        PARTITION OF analysis_report
        FOR VALUES FROM (` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:87`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE TABLE analysis_report_2026_06
        PARTITION OF analysis_report
        FOR VALUES FROM (` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:92`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE TABLE analysis_report_2026_07
        PARTITION OF analysis_report
        FOR VALUES FROM (` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:97`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE TABLE analysis_report_2026_08
        PARTITION OF analysis_report
        FOR VALUES FROM (` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:102`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE TABLE analysis_report_default
        PARTITION OF analysis_report DEFAULT
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:107`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE INDEX idx_landmark_payload_report ON landmark_payload (analysis_report_id)
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:131`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE INDEX idx_metric_evaluation_id ON metric_evaluation (id)
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:161`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE INDEX idx_metric_evaluation_report ON metric_evaluation (analysis_report_id)
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:164`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE INDEX idx_metric_evaluation_metric_id ON metric_evaluation (metric_id)
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:167`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE TABLE metric_evaluation_2026_05
        PARTITION OF metric_evaluation
        FOR VALUES FROM (` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:171`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE TABLE metric_evaluation_2026_06
        PARTITION OF metric_evaluation
        FOR VALUES FROM (` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:176`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE TABLE metric_evaluation_2026_07
        PARTITION OF metric_evaluation
        FOR VALUES FROM (` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:181`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE TABLE metric_evaluation_2026_08
        PARTITION OF metric_evaluation
        FOR VALUES FROM (` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:186`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE TABLE metric_evaluation_default
        PARTITION OF metric_evaluation DEFAULT
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:191`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE INDEX idx_against_ideal_eval ON metric_evaluation_against_ideal (metric_evaluation_id)
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:215`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE INDEX idx_against_ideal_ideal ON metric_evaluation_against_ideal (metric_ideal_id)
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:218`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON TABLE analysis_report IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:223`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN analysis_report.normalization_basis IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:227`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN analysis_report.user_context IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:231`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN metric_evaluation.is_low_confidence IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:235`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN metric_evaluation.displayable IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:239`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN metric_evaluation_against_ideal.deviation_normalized IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:243`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN metric_evaluation_against_ideal.severity_5 IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:247`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN metric_evaluation_against_ideal.severity_3 IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:251`
  ```ts
  await queryRunner.query(`
  ```

## `DROP TABLE IF EXISTS metric_evaluation_against_ideal` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:258`
  ```ts
  await queryRunner.query(`DROP TABLE IF EXISTS metric_evaluation_against_ideal`);
  ```

## `DROP TABLE IF EXISTS metric_evaluation` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:261`
  ```ts
  await queryRunner.query(`DROP TABLE IF EXISTS metric_evaluation`);
  ```

## `DROP TABLE IF EXISTS landmark_payload` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:262`
  ```ts
  await queryRunner.query(`DROP TABLE IF EXISTS landmark_payload`);
  ```

## `DROP TABLE IF EXISTS analysis_report` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:263`
  ```ts
  await queryRunner.query(`DROP TABLE IF EXISTS analysis_report`);
  ```

## `DROP TYPE IF EXISTS severity_3_enum` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:265`
  ```ts
  await queryRunner.query(`DROP TYPE IF EXISTS severity_3_enum`);
  ```

## `DROP TYPE IF EXISTS severity_5_enum` (1)

- [rawSql] `nest/src/database/migrations/1746000030000-EvaluationsAndRoot.ts:266`
  ```ts
  await queryRunner.query(`DROP TYPE IF EXISTS severity_5_enum`);
  ```

## `
      CREATE TYPE score_band_enum AS ENUM (
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000050000-RegionalAndGlobalScoring.ts:71`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE TABLE region_metric_weights_version (
        version       TEXT PRIMARY KEY,
        description   TEXT,
        is_active     BOOLEAN NOT NULL DEFAULT FALSE,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000050000-RegionalAndGlobalScoring.ts:81`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE UNIQUE INDEX uq_region_weights_version_active
        ON region_metric_weights_version (is_active) WHERE is_active = TRUE
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000050000-RegionalAndGlobalScoring.ts:89`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE INDEX idx_region_metric_weight_version
        ON region_metric_weight (version)
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000050000-RegionalAndGlobalScoring.ts:107`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE INDEX idx_region_metric_weight_region
        ON region_metric_weight (region)
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000050000-RegionalAndGlobalScoring.ts:111`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE TABLE global_weights_version (
        version            TEXT PRIMARY KEY,
        description        TEXT,
        is_active          BOOLEAN NOT NULL DEFAULT FALSE,
        critical_regions   JSONB NOT NULL DEFAULT ` (1)

- [rawSql] `nest/src/database/migrations/1746000050000-RegionalAndGlobalScoring.ts:117`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE UNIQUE INDEX uq_global_weights_version_active
        ON global_weights_version (is_active) WHERE is_active = TRUE
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000050000-RegionalAndGlobalScoring.ts:126`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE INDEX idx_global_weight_version ON global_weight (version)
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000050000-RegionalAndGlobalScoring.ts:142`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE analysis_report
        ADD COLUMN region_metric_weights_version TEXT
          REFERENCES region_metric_weights_version(version),
        ADD COLUMN global_weights_version TEXT
          REFERENCES global_weights_version(version)
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000050000-RegionalAndGlobalScoring.ts:147`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE INDEX idx_regional_score_report ON regional_score (analysis_report_id)
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000050000-RegionalAndGlobalScoring.ts:172`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE INDEX idx_global_score_report ON global_score (analysis_report_id)
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000050000-RegionalAndGlobalScoring.ts:196`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON TABLE region_metric_weight IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000050000-RegionalAndGlobalScoring.ts:201`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN global_weights_version.critical_regions IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000050000-RegionalAndGlobalScoring.ts:205`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN global_score.band IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000050000-RegionalAndGlobalScoring.ts:209`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON CONSTRAINT ck_global_score_displayable_consistency ON global_score IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000050000-RegionalAndGlobalScoring.ts:213`
  ```ts
  await queryRunner.query(`
  ```

## `INSERT INTO region_metric_weights_version (version, description, is_active)
         VALUES ($1, $2, TRUE)
         ON CONFLICT (version) DO NOTHING` (1)

- [rawSql] `nest/src/database/migrations/1746000050000-RegionalAndGlobalScoring.ts:219`
  ```ts
  await queryRunner.query(
  ```

## `INSERT INTO global_weights_version (version, description, is_active, critical_regions)
         VALUES ($1, $2, TRUE, $3::jsonb)
         ON CONFLICT (version) DO NOTHING` (1)

- [rawSql] `nest/src/database/migrations/1746000050000-RegionalAndGlobalScoring.ts:243`
  ```ts
  await queryRunner.query(
  ```

## `INSERT INTO global_weight (version, region, weight)
           VALUES ($1, $2::metric_region_enum, $3)
           ON CONFLICT ON CONSTRAINT uq_global_weight_version_region DO NOTHING` (1)

- [rawSql] `nest/src/database/migrations/1746000050000-RegionalAndGlobalScoring.ts:255`
  ```ts
  await queryRunner.query(
  ```

## `DROP TABLE IF EXISTS global_score` (1)

- [rawSql] `nest/src/database/migrations/1746000050000-RegionalAndGlobalScoring.ts:265`
  ```ts
  await queryRunner.query(`DROP TABLE IF EXISTS global_score`);
  ```

## `DROP TABLE IF EXISTS regional_score` (1)

- [rawSql] `nest/src/database/migrations/1746000050000-RegionalAndGlobalScoring.ts:266`
  ```ts
  await queryRunner.query(`DROP TABLE IF EXISTS regional_score`);
  ```

## `
      ALTER TABLE analysis_report
        DROP COLUMN IF EXISTS global_weights_version,
        DROP COLUMN IF EXISTS region_metric_weights_version
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000050000-RegionalAndGlobalScoring.ts:267`
  ```ts
  await queryRunner.query(`
  ```

## `DROP TABLE IF EXISTS global_weight` (1)

- [rawSql] `nest/src/database/migrations/1746000050000-RegionalAndGlobalScoring.ts:272`
  ```ts
  await queryRunner.query(`DROP TABLE IF EXISTS global_weight`);
  ```

## `DROP TABLE IF EXISTS global_weights_version` (1)

- [rawSql] `nest/src/database/migrations/1746000050000-RegionalAndGlobalScoring.ts:273`
  ```ts
  await queryRunner.query(`DROP TABLE IF EXISTS global_weights_version`);
  ```

## `DROP TABLE IF EXISTS region_metric_weight` (1)

- [rawSql] `nest/src/database/migrations/1746000050000-RegionalAndGlobalScoring.ts:274`
  ```ts
  await queryRunner.query(`DROP TABLE IF EXISTS region_metric_weight`);
  ```

## `DROP TABLE IF EXISTS region_metric_weights_version` (1)

- [rawSql] `nest/src/database/migrations/1746000050000-RegionalAndGlobalScoring.ts:275`
  ```ts
  await queryRunner.query(`DROP TABLE IF EXISTS region_metric_weights_version`);
  ```

## `DROP TYPE IF EXISTS score_band_enum` (1)

- [rawSql] `nest/src/database/migrations/1746000050000-RegionalAndGlobalScoring.ts:276`
  ```ts
  await queryRunner.query(`DROP TYPE IF EXISTS score_band_enum`);
  ```

## `ALTER TYPE metric_region_enum ADD VALUE IF NOT EXISTS ` (1)

- [rawSql] `nest/src/database/migrations/1746000095000-AddCheekbonesEnumValue.ts:20`
  ```ts
  await queryRunner.query(
  ```

## `
      ALTER TABLE landmark_payload
        ADD COLUMN IF NOT EXISTS landmark_stability_scores JSONB
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000140000-AddLandmarkStabilityColumns.ts:39`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE landmark_payload
        ADD COLUMN IF NOT EXISTS normalization_applied
          BOOLEAN NOT NULL DEFAULT FALSE
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000140000-AddLandmarkStabilityColumns.ts:45`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE INDEX IF NOT EXISTS idx_landmark_payload_has_stability
        ON landmark_payload (analysis_report_id)
        WHERE landmark_stability_scores IS NOT NULL
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000140000-AddLandmarkStabilityColumns.ts:53`
  ```ts
  await queryRunner.query(`
  ```

## `
      DROP INDEX IF EXISTS idx_landmark_payload_has_stability
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000140000-AddLandmarkStabilityColumns.ts:61`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE landmark_payload
        DROP COLUMN IF EXISTS normalization_applied
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000140000-AddLandmarkStabilityColumns.ts:65`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE landmark_payload
        DROP COLUMN IF EXISTS landmark_stability_scores
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000140000-AddLandmarkStabilityColumns.ts:70`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE region_metric_weights_version
        ADD COLUMN IF NOT EXISTS is_provisional BOOLEAN NOT NULL DEFAULT FALSE
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000150000-RebalanceWeightsV15.ts:202`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN region_metric_weights_version.is_provisional IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000150000-RebalanceWeightsV15.ts:206`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE global_weights_version
        ADD COLUMN IF NOT EXISTS is_provisional BOOLEAN NOT NULL DEFAULT FALSE
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000150000-RebalanceWeightsV15.ts:211`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN global_weights_version.is_provisional IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000150000-RebalanceWeightsV15.ts:215`
  ```ts
  await queryRunner.query(`
  ```

## `INSERT INTO region_metric_weights_version
         (version, description, is_active, is_provisional)
       VALUES ($1, $2, FALSE, TRUE)
       ON CONFLICT (version) DO NOTHING` (1)

- [rawSql] `nest/src/database/migrations/1746000150000-RebalanceWeightsV15.ts:223`
  ```ts
  await queryRunner.query(
  ```

## `INSERT INTO region_metric_weight
           (version, region, metric_id, weight)
         VALUES ($1, $2::metric_region_enum, $3, $4)
         ON CONFLICT (version, region, metric_id) DO NOTHING` (1)

- [rawSql] `nest/src/database/migrations/1746000150000-RebalanceWeightsV15.ts:236`
  ```ts
  await queryRunner.query(
  ```

## `INSERT INTO global_weights_version
         (version, description, is_active, is_provisional, critical_regions)
       VALUES ($1, $2, FALSE, TRUE, $3::jsonb)
       ON CONFLICT (version) DO NOTHING` (1)

- [rawSql] `nest/src/database/migrations/1746000150000-RebalanceWeightsV15.ts:246`
  ```ts
  await queryRunner.query(
  ```

## `INSERT INTO global_weight
           (version, region, weight)
         VALUES ($1, $2::metric_region_enum, $3)
         ON CONFLICT (version, region) DO NOTHING` (1)

- [rawSql] `nest/src/database/migrations/1746000150000-RebalanceWeightsV15.ts:260`
  ```ts
  await queryRunner.query(
  ```

## `SELECT COALESCE(SUM(weight), 0)::float8 AS s
         FROM global_weight WHERE version = $1` (1)

- [rawSql] `nest/src/database/migrations/1746000150000-RebalanceWeightsV15.ts:270`
  ```ts
  const sumRows = (await queryRunner.query(
  ```

## `DELETE FROM global_weight WHERE version = $1` (1)

- [rawSql] `nest/src/database/migrations/1746000150000-RebalanceWeightsV15.ts:286`
  ```ts
  await queryRunner.query(
  ```

## `DELETE FROM global_weights_version WHERE version = $1` (1)

- [rawSql] `nest/src/database/migrations/1746000150000-RebalanceWeightsV15.ts:290`
  ```ts
  await queryRunner.query(
  ```

## `DELETE FROM region_metric_weight WHERE version = $1` (1)

- [rawSql] `nest/src/database/migrations/1746000150000-RebalanceWeightsV15.ts:294`
  ```ts
  await queryRunner.query(
  ```

## `DELETE FROM region_metric_weights_version WHERE version = $1` (1)

- [rawSql] `nest/src/database/migrations/1746000150000-RebalanceWeightsV15.ts:298`
  ```ts
  await queryRunner.query(
  ```

## `ALTER TABLE global_weights_version DROP COLUMN IF EXISTS is_provisional` (1)

- [rawSql] `nest/src/database/migrations/1746000150000-RebalanceWeightsV15.ts:305`
  ```ts
  await queryRunner.query(
  ```

## `ALTER TABLE region_metric_weights_version DROP COLUMN IF EXISTS is_provisional` (1)

- [rawSql] `nest/src/database/migrations/1746000150000-RebalanceWeightsV15.ts:308`
  ```ts
  await queryRunner.query(
  ```

## `
      CREATE TYPE overlay_category_enum AS ENUM (
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000160000-M3OverlayCatalog.ts:79`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE TYPE rendered_asset_type_enum AS ENUM (
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000160000-M3OverlayCatalog.ts:85`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE TYPE rendered_asset_format_enum AS ENUM (
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000160000-M3OverlayCatalog.ts:96`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE TABLE overlay_catalog_version (
        version       TEXT PRIMARY KEY,
        description   TEXT,
        is_active     BOOLEAN NOT NULL DEFAULT FALSE,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000160000-M3OverlayCatalog.ts:106`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE UNIQUE INDEX uq_overlay_catalog_version_active
        ON overlay_catalog_version (is_active)
        WHERE is_active = TRUE
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000160000-M3OverlayCatalog.ts:115`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE TABLE overlay_definition (
        overlay_id        TEXT NOT NULL,
        version           TEXT NOT NULL,
        display_name      JSONB NOT NULL DEFAULT ` (1)

- [rawSql] `nest/src/database/migrations/1746000160000-M3OverlayCatalog.ts:125`
  ```ts
  await queryRunner.query(`
  ```

## `CREATE INDEX idx_overlay_definition_version ON overlay_definition (version)` (1)

- [rawSql] `nest/src/database/migrations/1746000160000-M3OverlayCatalog.ts:145`
  ```ts
  await queryRunner.query(
  ```

## `CREATE INDEX idx_overlay_definition_category ON overlay_definition (category)` (1)

- [rawSql] `nest/src/database/migrations/1746000160000-M3OverlayCatalog.ts:148`
  ```ts
  await queryRunner.query(
  ```

## `CREATE INDEX idx_overlay_metric_dep_overlay ON overlay_metric_dependency (overlay_id, overlay_version)` (1)

- [rawSql] `nest/src/database/migrations/1746000160000-M3OverlayCatalog.ts:178`
  ```ts
  await queryRunner.query(
  ```

## `CREATE INDEX idx_overlay_metric_dep_metric ON overlay_metric_dependency (metric_id)` (1)

- [rawSql] `nest/src/database/migrations/1746000160000-M3OverlayCatalog.ts:181`
  ```ts
  await queryRunner.query(
  ```

## `CREATE INDEX idx_rendered_asset_report ON rendered_asset (analysis_report_id)` (1)

- [rawSql] `nest/src/database/migrations/1746000160000-M3OverlayCatalog.ts:222`
  ```ts
  await queryRunner.query(
  ```

## `CREATE INDEX idx_rendered_asset_type ON rendered_asset (asset_type)` (1)

- [rawSql] `nest/src/database/migrations/1746000160000-M3OverlayCatalog.ts:225`
  ```ts
  await queryRunner.query(
  ```

## `
      CREATE INDEX idx_rendered_asset_expiry
        ON rendered_asset (expires_at)
        WHERE is_expired = FALSE
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000160000-M3OverlayCatalog.ts:230`
  ```ts
  await queryRunner.query(`
  ```

## `
      INSERT INTO overlay_catalog_version (version, description, is_active)
      VALUES (
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000160000-M3OverlayCatalog.ts:240`
  ```ts
  await queryRunner.query(`
  ```

## `DROP TABLE IF EXISTS rendered_asset` (1)

- [rawSql] `nest/src/database/migrations/1746000160000-M3OverlayCatalog.ts:428`
  ```ts
  await queryRunner.query(`DROP TABLE IF EXISTS rendered_asset`);
  ```

## `DROP TABLE IF EXISTS overlay_metric_dependency` (1)

- [rawSql] `nest/src/database/migrations/1746000160000-M3OverlayCatalog.ts:429`
  ```ts
  await queryRunner.query(`DROP TABLE IF EXISTS overlay_metric_dependency`);
  ```

## `DROP TABLE IF EXISTS overlay_definition` (1)

- [rawSql] `nest/src/database/migrations/1746000160000-M3OverlayCatalog.ts:430`
  ```ts
  await queryRunner.query(`DROP TABLE IF EXISTS overlay_definition`);
  ```

## `DROP TABLE IF EXISTS overlay_catalog_version` (1)

- [rawSql] `nest/src/database/migrations/1746000160000-M3OverlayCatalog.ts:431`
  ```ts
  await queryRunner.query(`DROP TABLE IF EXISTS overlay_catalog_version`);
  ```

## `DROP TYPE IF EXISTS rendered_asset_format_enum` (1)

- [rawSql] `nest/src/database/migrations/1746000160000-M3OverlayCatalog.ts:432`
  ```ts
  await queryRunner.query(`DROP TYPE IF EXISTS rendered_asset_format_enum`);
  ```

## `DROP TYPE IF EXISTS rendered_asset_type_enum` (1)

- [rawSql] `nest/src/database/migrations/1746000160000-M3OverlayCatalog.ts:433`
  ```ts
  await queryRunner.query(`DROP TYPE IF EXISTS rendered_asset_type_enum`);
  ```

## `DROP TYPE IF EXISTS overlay_category_enum` (1)

- [rawSql] `nest/src/database/migrations/1746000160000-M3OverlayCatalog.ts:434`
  ```ts
  await queryRunner.query(`DROP TYPE IF EXISTS overlay_category_enum`);
  ```

## `
      ALTER TABLE metric_evaluation_against_ideal
        ADD COLUMN IF NOT EXISTS improvement_vector_x NUMERIC(10,6),
        ADD COLUMN IF NOT EXISTS improvement_vector_y NUMERIC(10,6)
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000170000-M32AddImprovementVector.ts:26`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN metric_evaluation_against_ideal.improvement_vector_x IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000170000-M32AddImprovementVector.ts:32`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN metric_evaluation_against_ideal.improvement_vector_y IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000170000-M32AddImprovementVector.ts:36`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE metric_evaluation_against_ideal
        DROP COLUMN IF EXISTS improvement_vector_x,
        DROP COLUMN IF EXISTS improvement_vector_y
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000170000-M32AddImprovementVector.ts:43`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE TABLE IF NOT EXISTS diagnostic_template_version (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        version     TEXT NOT NULL UNIQUE,
        is_active   BOOLEAN NOT NULL DEFAULT FALSE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        notes       TEXT
      )
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000180000-M41DiagnosticTemplates.ts:85`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE UNIQUE INDEX IF NOT EXISTS ux_diag_tpl_version_active
        ON diagnostic_template_version (is_active)
        WHERE is_active = TRUE
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000180000-M41DiagnosticTemplates.ts:94`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON TABLE diagnostic_template_version IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000180000-M41DiagnosticTemplates.ts:99`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE INDEX IF NOT EXISTS ix_diagnostic_template_lookup
        ON diagnostic_template (metric_id, severity, direction, size)
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000180000-M41DiagnosticTemplates.ts:122`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON TABLE diagnostic_template IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000180000-M41DiagnosticTemplates.ts:126`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN diagnostic_template.direction IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000180000-M41DiagnosticTemplates.ts:130`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN diagnostic_template.size IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000180000-M41DiagnosticTemplates.ts:134`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN diagnostic_template.placeholders_used IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000180000-M41DiagnosticTemplates.ts:138`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE TABLE IF NOT EXISTS template_blacklist_version (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        version     TEXT NOT NULL UNIQUE,
        is_active   BOOLEAN NOT NULL DEFAULT FALSE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        notes       TEXT
      )
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000180000-M41DiagnosticTemplates.ts:146`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE UNIQUE INDEX IF NOT EXISTS ux_tpl_blacklist_version_active
        ON template_blacklist_version (is_active)
        WHERE is_active = TRUE
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000180000-M41DiagnosticTemplates.ts:155`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON TABLE template_blacklist_version IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000180000-M41DiagnosticTemplates.ts:160`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE TABLE IF NOT EXISTS template_blacklist_term (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        version     TEXT NOT NULL REFERENCES template_blacklist_version (version) ON DELETE RESTRICT,
        term        TEXT NOT NULL,
        category    TEXT NOT NULL CHECK (category IN (
                      ` (1)

- [rawSql] `nest/src/database/migrations/1746000180000-M41DiagnosticTemplates.ts:168`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN template_blacklist_term.term IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000180000-M41DiagnosticTemplates.ts:184`
  ```ts
  await queryRunner.query(`
  ```

## `
      INSERT INTO diagnostic_template (version, metric_id, severity, direction, size, template_pt, placeholders_used)
      VALUES
        (
          ` (1)

- [rawSql] `nest/src/database/migrations/1746000180000-M41DiagnosticTemplates.ts:206`
  ```ts
  await queryRunner.query(`
  ```

## `DROP TABLE IF EXISTS template_blacklist_term CASCADE` (1)

- [rawSql] `nest/src/database/migrations/1746000180000-M41DiagnosticTemplates.ts:270`
  ```ts
  await queryRunner.query(`DROP TABLE IF EXISTS template_blacklist_term CASCADE`);
  ```

## `DROP TABLE IF EXISTS template_blacklist_version CASCADE` (1)

- [rawSql] `nest/src/database/migrations/1746000180000-M41DiagnosticTemplates.ts:271`
  ```ts
  await queryRunner.query(`DROP TABLE IF EXISTS template_blacklist_version CASCADE`);
  ```

## `DROP TABLE IF EXISTS diagnostic_template CASCADE` (1)

- [rawSql] `nest/src/database/migrations/1746000180000-M41DiagnosticTemplates.ts:272`
  ```ts
  await queryRunner.query(`DROP TABLE IF EXISTS diagnostic_template CASCADE`);
  ```

## `DROP TABLE IF EXISTS diagnostic_template_version CASCADE` (1)

- [rawSql] `nest/src/database/migrations/1746000180000-M41DiagnosticTemplates.ts:273`
  ```ts
  await queryRunner.query(`DROP TABLE IF EXISTS diagnostic_template_version CASCADE`);
  ```

## `
      DELETE FROM overlay_metric_dependency
      WHERE overlay_id IN (` (1)

- [rawSql] `nest/src/database/migrations/1746000190000-M33HeatmapOverlays.ts:132`
  ```ts
  await queryRunner.query(`
  ```

## `
      DELETE FROM overlay_definition
      WHERE overlay_id IN (` (1)

- [rawSql] `nest/src/database/migrations/1746000190000-M33HeatmapOverlays.ts:137`
  ```ts
  await queryRunner.query(`
  ```

## `
      DO $$ BEGIN
        CREATE TYPE recommendation_category_enum AS ENUM (
          ` (1)

- [rawSql] `nest/src/database/migrations/1746000200000-M43RecommendationCatalog.ts:73`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE TABLE IF NOT EXISTS recommendation_catalog_version (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        version     TEXT NOT NULL UNIQUE,
        is_active   BOOLEAN NOT NULL DEFAULT FALSE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        notes       TEXT
      )
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000200000-M43RecommendationCatalog.ts:89`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE UNIQUE INDEX IF NOT EXISTS ux_rec_catalog_version_active
        ON recommendation_catalog_version (is_active)
        WHERE is_active = TRUE
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000200000-M43RecommendationCatalog.ts:98`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON TABLE recommendation_catalog_version IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000200000-M43RecommendationCatalog.ts:103`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE INDEX IF NOT EXISTS ix_rec_catalog_version
        ON recommendation_catalog (version)
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000200000-M43RecommendationCatalog.ts:133`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE INDEX IF NOT EXISTS ix_rec_catalog_category
        ON recommendation_catalog (category)
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000200000-M43RecommendationCatalog.ts:137`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON TABLE recommendation_catalog IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000200000-M43RecommendationCatalog.ts:141`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN recommendation_catalog.id IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000200000-M43RecommendationCatalog.ts:145`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN recommendation_catalog.risk_level IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000200000-M43RecommendationCatalog.ts:149`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN recommendation_catalog.professional_type IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000200000-M43RecommendationCatalog.ts:153`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE TABLE IF NOT EXISTS recommendation_trigger (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recommendation_id     TEXT NOT NULL REFERENCES recommendation_catalog (id) ON DELETE CASCADE,
        metric_id             TEXT NOT NULL,
        severity              severity_5_enum NOT NULL,
        direction             TEXT NOT NULL DEFAULT ` (1)

- [rawSql] `nest/src/database/migrations/1746000200000-M43RecommendationCatalog.ts:161`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE INDEX IF NOT EXISTS ix_rec_trigger_recommendation
        ON recommendation_trigger (recommendation_id)
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000200000-M43RecommendationCatalog.ts:172`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE INDEX IF NOT EXISTS ix_rec_trigger_metric_severity
        ON recommendation_trigger (metric_id, severity)
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000200000-M43RecommendationCatalog.ts:176`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON TABLE recommendation_trigger IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000200000-M43RecommendationCatalog.ts:180`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN recommendation_trigger.direction IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000200000-M43RecommendationCatalog.ts:184`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN recommendation_trigger.additional_conditions IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000200000-M43RecommendationCatalog.ts:188`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE INDEX IF NOT EXISTS ix_rec_link_report
        ON recommendation_link (analysis_report_id, analysis_report_generated_at)
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000200000-M43RecommendationCatalog.ts:208`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE INDEX IF NOT EXISTS ix_rec_link_recommendation
        ON recommendation_link (recommendation_id)
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000200000-M43RecommendationCatalog.ts:212`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE INDEX IF NOT EXISTS ix_rec_link_displayed
        ON recommendation_link (analysis_report_id, is_displayed_to_user)
        WHERE is_displayed_to_user = TRUE
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000200000-M43RecommendationCatalog.ts:216`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON TABLE recommendation_link IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000200000-M43RecommendationCatalog.ts:221`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN recommendation_link.analysis_report_id IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000200000-M43RecommendationCatalog.ts:225`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN recommendation_link.triggered_by_metric_evaluation_ids IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000200000-M43RecommendationCatalog.ts:229`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN recommendation_link.final_priority_in_session IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000200000-M43RecommendationCatalog.ts:233`
  ```ts
  await queryRunner.query(`
  ```

## `
      INSERT INTO recommendation_catalog_version (version, is_active, notes)
      VALUES (
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000200000-M43RecommendationCatalog.ts:241`
  ```ts
  await queryRunner.query(`
  ```

## `DROP TABLE IF EXISTS recommendation_link` (1)

- [rawSql] `nest/src/database/migrations/1746000200000-M43RecommendationCatalog.ts:253`
  ```ts
  await queryRunner.query(`DROP TABLE IF EXISTS recommendation_link`);
  ```

## `DROP TABLE IF EXISTS recommendation_trigger` (1)

- [rawSql] `nest/src/database/migrations/1746000200000-M43RecommendationCatalog.ts:254`
  ```ts
  await queryRunner.query(`DROP TABLE IF EXISTS recommendation_trigger`);
  ```

## `DROP TABLE IF EXISTS recommendation_catalog` (1)

- [rawSql] `nest/src/database/migrations/1746000200000-M43RecommendationCatalog.ts:255`
  ```ts
  await queryRunner.query(`DROP TABLE IF EXISTS recommendation_catalog`);
  ```

## `DROP TABLE IF EXISTS recommendation_catalog_version` (1)

- [rawSql] `nest/src/database/migrations/1746000200000-M43RecommendationCatalog.ts:256`
  ```ts
  await queryRunner.query(`DROP TABLE IF EXISTS recommendation_catalog_version`);
  ```

## `DROP TYPE IF EXISTS recommendation_category_enum` (1)

- [rawSql] `nest/src/database/migrations/1746000200000-M43RecommendationCatalog.ts:257`
  ```ts
  await queryRunner.query(`DROP TYPE IF EXISTS recommendation_category_enum`);
  ```

## `UPDATE recommendation_catalog_version SET is_active = FALSE WHERE is_active = TRUE` (1)

- [rawSql] `nest/src/database/migrations/1746000210000-M43RecommendationCatalogSeed.ts:52`
  ```ts
  await queryRunner.query(`UPDATE recommendation_catalog_version SET is_active = FALSE WHERE is_active = TRUE`);
  ```

## `
      INSERT INTO recommendation_catalog_version (version, is_active, notes)
      VALUES (` (1)

- [rawSql] `nest/src/database/migrations/1746000210000-M43RecommendationCatalogSeed.ts:53`
  ```ts
  await queryRunner.query(`
  ```

## `
      DELETE FROM recommendation_trigger
      WHERE recommendation_id IN (
        SELECT id FROM recommendation_catalog WHERE version = ` (1)

- [rawSql] `nest/src/database/migrations/1746000210000-M43RecommendationCatalogSeed.ts:659`
  ```ts
  await queryRunner.query(`
  ```

## `
      DELETE FROM recommendation_catalog WHERE version = ` (1)

- [rawSql] `nest/src/database/migrations/1746000210000-M43RecommendationCatalogSeed.ts:665`
  ```ts
  await queryRunner.query(`
  ```

## `UPDATE recommendation_catalog_version SET is_active = FALSE WHERE version = ` (1)

- [rawSql] `nest/src/database/migrations/1746000210000-M43RecommendationCatalogSeed.ts:669`
  ```ts
  await queryRunner.query(`UPDATE recommendation_catalog_version SET is_active = FALSE WHERE version = 'v1.0'`);
  ```

## `DELETE FROM recommendation_catalog_version WHERE version = ` (1)

- [rawSql] `nest/src/database/migrations/1746000210000-M43RecommendationCatalogSeed.ts:670`
  ```ts
  await queryRunner.query(`DELETE FROM recommendation_catalog_version WHERE version = 'v1.0'`);
  ```

## `UPDATE recommendation_catalog_version SET is_active = TRUE WHERE version = ` (1)

- [rawSql] `nest/src/database/migrations/1746000210000-M43RecommendationCatalogSeed.ts:671`
  ```ts
  await queryRunner.query(`UPDATE recommendation_catalog_version SET is_active = TRUE WHERE version = 'v0.1'`);
  ```

## `UPDATE diagnostic_template_version SET is_active = FALSE WHERE is_active = TRUE` (1)

- [rawSql] `nest/src/database/migrations/1746000220000-M42DiagnosticTemplatesV1.ts:86`
  ```ts
  await queryRunner.query(`UPDATE diagnostic_template_version SET is_active = FALSE WHERE is_active = TRUE`);
  ```

## `UPDATE diagnostic_template_version SET is_active = FALSE WHERE version = ` (1)

- [rawSql] `nest/src/database/migrations/1746000220000-M42DiagnosticTemplatesV1.ts:730`
  ```ts
  await queryRunner.query(`UPDATE diagnostic_template_version SET is_active = FALSE WHERE version = 'v1.0'`);
  ```

## `DELETE FROM diagnostic_template_version WHERE version = ` (1)

- [rawSql] `nest/src/database/migrations/1746000220000-M42DiagnosticTemplatesV1.ts:731`
  ```ts
  await queryRunner.query(`DELETE FROM diagnostic_template_version WHERE version = 'v1.0'`);
  ```

## `UPDATE diagnostic_template_version SET is_active = TRUE WHERE version = ` (1)

- [rawSql] `nest/src/database/migrations/1746000220000-M42DiagnosticTemplatesV1.ts:733`
  ```ts
  await queryRunner.query(`UPDATE diagnostic_template_version SET is_active = TRUE WHERE version = 'v0.1'`);
  ```

## `
      DO $$ BEGIN
        CREATE TYPE evidence_level_enum AS ENUM (` (1)

- [rawSql] `nest/src/database/migrations/1746000225000-M44LadderEnumValues.ts:27`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE recommendation_catalog
        ADD COLUMN IF NOT EXISTS invasiveness_level SMALLINT
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:50`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE recommendation_catalog
        ADD COLUMN IF NOT EXISTS evidence_level evidence_level_enum
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:54`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE recommendation_catalog
        ADD COLUMN IF NOT EXISTS clinical_pathway_required BOOLEAN NOT NULL DEFAULT FALSE
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:58`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE recommendation_catalog
        ADD COLUMN IF NOT EXISTS references_jsonb JSONB NOT NULL DEFAULT ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:62`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE recommendation_catalog
        ADD COLUMN IF NOT EXISTS disclaimer_template TEXT
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:66`
  ```ts
  await queryRunner.query(`
  ```

## `
      UPDATE recommendation_catalog
         SET invasiveness_level = CASE category
           WHEN ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:72`
  ```ts
  await queryRunner.query(`
  ```

## `
      UPDATE recommendation_catalog
         SET evidence_level = ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:86`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE recommendation_catalog
        ALTER COLUMN invasiveness_level SET NOT NULL
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:92`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE recommendation_catalog
        ALTER COLUMN evidence_level SET NOT NULL
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:96`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE recommendation_catalog
        ALTER COLUMN evidence_level SET DEFAULT ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:100`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE recommendation_catalog
        ADD CONSTRAINT chk_rec_catalog_invasiveness_range
        CHECK (invasiveness_level BETWEEN 0 AND 4)
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:104`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE recommendation_catalog
        ADD COLUMN IF NOT EXISTS requires_anecdotal_disclaimer BOOLEAN
        GENERATED ALWAYS AS (evidence_level = ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:111`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE recommendation_catalog
        ADD CONSTRAINT chk_rec_anecdotal_disclaimer
        CHECK (evidence_level <> ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:118`
  ```ts
  await queryRunner.query(`
  ```

## `
      DO $$
      DECLARE
        cname TEXT;
      BEGIN
        SELECT conname INTO cname
        FROM pg_constraint
        WHERE conrelid = ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:127`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE recommendation_trigger
        ADD COLUMN IF NOT EXISTS min_invasiveness_level SMALLINT
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:158`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE recommendation_trigger
        ADD COLUMN IF NOT EXISTS clinical_pathway_required BOOLEAN NOT NULL DEFAULT FALSE
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:162`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE recommendation_trigger
        ADD CONSTRAINT chk_rec_trigger_min_invasiveness_range
        CHECK (min_invasiveness_level IS NULL OR min_invasiveness_level BETWEEN 0 AND 4)
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:166`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN recommendation_catalog.invasiveness_level IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:173`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN recommendation_catalog.evidence_level IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:177`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN recommendation_catalog.clinical_pathway_required IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:181`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN recommendation_catalog.references_jsonb IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:185`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN recommendation_catalog.disclaimer_template IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:189`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN recommendation_trigger.min_invasiveness_level IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:193`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON COLUMN recommendation_trigger.clinical_pathway_required IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:197`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE recommendation_trigger
        DROP CONSTRAINT IF EXISTS chk_rec_trigger_min_invasiveness_range
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:207`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE recommendation_trigger
        DROP COLUMN IF EXISTS clinical_pathway_required
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:211`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE recommendation_trigger
        DROP COLUMN IF EXISTS min_invasiveness_level
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:215`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE recommendation_catalog
        DROP CONSTRAINT IF EXISTS chk_rec_professional_type
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:220`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE recommendation_catalog
        DROP CONSTRAINT IF EXISTS chk_rec_anecdotal_disclaimer
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:224`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE recommendation_catalog
        DROP CONSTRAINT IF EXISTS chk_rec_catalog_invasiveness_range
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:228`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE recommendation_catalog
        DROP COLUMN IF EXISTS requires_anecdotal_disclaimer
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:232`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE recommendation_catalog
        DROP COLUMN IF EXISTS disclaimer_template
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:236`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE recommendation_catalog
        DROP COLUMN IF EXISTS references_jsonb
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:240`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE recommendation_catalog
        DROP COLUMN IF EXISTS clinical_pathway_required
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:244`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE recommendation_catalog
        DROP COLUMN IF EXISTS evidence_level
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:248`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE recommendation_catalog
        DROP COLUMN IF EXISTS invasiveness_level
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:252`
  ```ts
  await queryRunner.query(`
  ```

## `DROP TYPE IF EXISTS evidence_level_enum` (1)

- [rawSql] `nest/src/database/migrations/1746000230000-M44RecommendationLadder.ts:257`
  ```ts
  await queryRunner.query(`DROP TYPE IF EXISTS evidence_level_enum`);
  ```

## `INSERT INTO diagnostic_template (
           version, metric_id, severity, direction, size,
           template_pt, placeholders_used
         ) VALUES (
           $1, $2, $3::severity_5_enum, $4, $5,
           $6, $7::jsonb
         ) ON CONFLICT (version, metric_id, severity, direction, size) DO NOTHING` (1)

- [rawSql] `nest/src/database/migrations/1746000250000-M42bDiagnosticTemplatesShortLong.ts:896`
  ```ts
  await queryRunner.query(
  ```

## `DELETE FROM diagnostic_template
         WHERE version = $1 AND metric_id = $2 AND severity = $3::severity_5_enum
           AND direction = $4 AND size = $5` (1)

- [rawSql] `nest/src/database/migrations/1746000250000-M42bDiagnosticTemplatesShortLong.ts:919`
  ```ts
  await queryRunner.query(
  ```

## `
      ALTER TABLE recommendation_catalog
        ADD COLUMN IF NOT EXISTS animation_config JSONB
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000250000-M44AnimationConfig.ts:39`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE INDEX IF NOT EXISTS idx_rec_catalog_animation_config_not_null
        ON recommendation_catalog (id)
        WHERE animation_config IS NOT NULL
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000250000-M44AnimationConfig.ts:69`
  ```ts
  await queryRunner.query(`
  ```

## `
      DROP INDEX IF EXISTS idx_rec_catalog_animation_config_not_null
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000250000-M44AnimationConfig.ts:77`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE recommendation_catalog
        DROP COLUMN IF EXISTS animation_config
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000250000-M44AnimationConfig.ts:86`
  ```ts
  await queryRunner.query(`
  ```

## `
      UPDATE template_blacklist_version
         SET is_active = FALSE
       WHERE is_active = TRUE
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000260000-M42cTemplateBlacklistExtensionV02.ts:43`
  ```ts
  await queryRunner.query(`
  ```

## `
      INSERT INTO template_blacklist_term (version, term, category, notes)
      VALUES
        -- pejorative tone (8)
        (` (1)

- [rawSql] `nest/src/database/migrations/1746000260000-M42cTemplateBlacklistExtensionV02.ts:77`
  ```ts
  await queryRunner.query(`
  ```

## `
      DELETE FROM template_blacklist_term WHERE version = ` (1)

- [rawSql] `nest/src/database/migrations/1746000260000-M42cTemplateBlacklistExtensionV02.ts:104`
  ```ts
  await queryRunner.query(`
  ```

## `
      DELETE FROM template_blacklist_version WHERE version = ` (1)

- [rawSql] `nest/src/database/migrations/1746000260000-M42cTemplateBlacklistExtensionV02.ts:107`
  ```ts
  await queryRunner.query(`
  ```

## `
      UPDATE template_blacklist_version
         SET is_active = TRUE
       WHERE version = ` (1)

- [rawSql] `nest/src/database/migrations/1746000260000-M42cTemplateBlacklistExtensionV02.ts:110`
  ```ts
  await queryRunner.query(`
  ```

## `UPDATE recommendation_catalog
            SET animation_config = $1::jsonb
          WHERE id = $2 AND category = ` (1)

- [rawSql] `nest/src/database/migrations/1746000260000-M44AnimationConfigSeed.ts:115`
  ```ts
  await queryRunner.query(
  ```

## `UPDATE recommendation_catalog
          SET animation_config = NULL
        WHERE id = ANY($1::text[])` (1)

- [rawSql] `nest/src/database/migrations/1746000260000-M44AnimationConfigSeed.ts:126`
  ```ts
  await queryRunner.query(
  ```

## `
      ALTER TABLE recommendation_catalog
        ADD COLUMN IF NOT EXISTS biometric_config JSONB
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000270000-M44BiometricConfig.ts:29`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE recommendation_catalog
        DROP CONSTRAINT IF EXISTS recommendation_catalog_biometric_config_chk
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000270000-M44BiometricConfig.ts:60`
  ```ts
  await queryRunner.query(`
  ```

## `
      ALTER TABLE recommendation_catalog
        DROP COLUMN IF EXISTS biometric_config
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000270000-M44BiometricConfig.ts:65`
  ```ts
  await queryRunner.query(`
  ```

## `UPDATE recommendation_catalog
            SET biometric_config = $1::jsonb
          WHERE id = $2 AND category = ` (1)

- [rawSql] `nest/src/database/migrations/1746000280000-M44BiometricConfigSeedPoc.ts:59`
  ```ts
  await queryRunner.query(
  ```

## `UPDATE recommendation_catalog
          SET biometric_config = NULL
        WHERE id = ANY($1::text[])` (1)

- [rawSql] `nest/src/database/migrations/1746000280000-M44BiometricConfigSeedPoc.ts:70`
  ```ts
  await queryRunner.query(
  ```

## `
      CREATE TABLE IF NOT EXISTS priority_score_audit (
        id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        recommendation_link_id          UUID NOT NULL,
        analysis_report_id              UUID NOT NULL,
        analysis_report_generated_at    TIMESTAMPTZ NOT NULL,

        ` (1)

- [rawSql] `nest/src/database/migrations/1746000290000-M44PriorityScoreAudit.ts:32`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE INDEX IF NOT EXISTS idx_psa_report
        ON priority_score_audit (analysis_report_id, analysis_report_generated_at)
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000290000-M44PriorityScoreAudit.ts:82`
  ```ts
  await queryRunner.query(`
  ```

## `
      CREATE INDEX IF NOT EXISTS idx_psa_suppression
        ON priority_score_audit (suppression_reason)
        WHERE suppression_reason IS NOT NULL
    ` (1)

- [rawSql] `nest/src/database/migrations/1746000290000-M44PriorityScoreAudit.ts:87`
  ```ts
  await queryRunner.query(`
  ```

## `
      COMMENT ON TABLE priority_score_audit IS
        ` (1)

- [rawSql] `nest/src/database/migrations/1746000290000-M44PriorityScoreAudit.ts:93`
  ```ts
  await queryRunner.query(`
  ```

## `COMMENT ON COLUMN priority_score_audit.${col} IS ` (1)

- [rawSql] `nest/src/database/migrations/1746000290000-M44PriorityScoreAudit.ts:113`
  ```ts
  await queryRunner.query(
  ```

## `DROP INDEX IF EXISTS idx_psa_suppression` (1)

- [rawSql] `nest/src/database/migrations/1746000290000-M44PriorityScoreAudit.ts:120`
  ```ts
  await queryRunner.query(`DROP INDEX IF EXISTS idx_psa_suppression`);
  ```

## `DROP INDEX IF EXISTS idx_psa_report` (1)

- [rawSql] `nest/src/database/migrations/1746000290000-M44PriorityScoreAudit.ts:121`
  ```ts
  await queryRunner.query(`DROP INDEX IF EXISTS idx_psa_report`);
  ```

## `DROP TABLE IF EXISTS priority_score_audit` (1)

- [rawSql] `nest/src/database/migrations/1746000290000-M44PriorityScoreAudit.ts:122`
  ```ts
  await queryRunner.query(`DROP TABLE IF EXISTS priority_score_audit`);
  ```

## `UPDATE metric_definition
         SET requires_pixel_analysis = false
       WHERE metric_id = ` (1)

- [rawSql] `nest/src/database/migrations/1746000300000-SeedMetricsWaveC1.ts:380`
  ```ts
  await queryRunner.query(
  ```

## `UPDATE metric_definition
         SET requires_pixel_analysis = false,
             unit = ` (1)

- [rawSql] `nest/src/database/migrations/1746000300000-SeedMetricsWaveC1.ts:387`
  ```ts
  await queryRunner.query(
  ```

## `UPDATE metric_definition
         SET presentation_only = false
       WHERE metric_id = ` (1)

- [rawSql] `nest/src/database/migrations/1746000300000-SeedMetricsWaveC1.ts:395`
  ```ts
  await queryRunner.query(
  ```

## `DELETE FROM region_metric_weight
         WHERE version = ` (1)

- [rawSql] `nest/src/database/migrations/1746000300000-SeedMetricsWaveC1.ts:460`
  ```ts
  await queryRunner.query(
  ```

## `DELETE FROM metric_ideal
         WHERE ideals_version = ` (1)

- [rawSql] `nest/src/database/migrations/1746000300000-SeedMetricsWaveC1.ts:476`
  ```ts
  await queryRunner.query(
  ```

## `UPDATE metric_definition
         SET requires_pixel_analysis = true
       WHERE metric_id IN (` (1)

- [rawSql] `nest/src/database/migrations/1746000300000-SeedMetricsWaveC1.ts:483`
  ```ts
  await queryRunner.query(
  ```

## `UPDATE metric_definition
         SET unit = ` (1)

- [rawSql] `nest/src/database/migrations/1746000300000-SeedMetricsWaveC1.ts:488`
  ```ts
  await queryRunner.query(
  ```

## `UPDATE metric_definition
         SET presentation_only = true
       WHERE metric_id = ` (1)

- [rawSql] `nest/src/database/migrations/1746000300000-SeedMetricsWaveC1.ts:493`
  ```ts
  await queryRunner.query(
  ```

## `
      CREATE TABLE IF NOT EXISTS metric_content (
        metric_id     TEXT NOT NULL,
        locale        TEXT NOT NULL DEFAULT ` (1)

- [rawSql] `nest/src/database/migrations/1746000400000-MetricContent.ts:395`
  ```ts
  await queryRunner.query(`
  ```

## `CREATE INDEX IF NOT EXISTS idx_metric_content_metric_id ON metric_content (metric_id)` (1)

- [rawSql] `nest/src/database/migrations/1746000400000-MetricContent.ts:410`
  ```ts
  await queryRunner.query(
  ```

## `DROP TABLE IF EXISTS metric_content` (1)

- [rawSql] `nest/src/database/migrations/1746000400000-MetricContent.ts:459`
  ```ts
  await queryRunner.query(`DROP TABLE IF EXISTS metric_content`);
  ```

## `
      CREATE TABLE IF NOT EXISTS diagnosis_report (
        run_id       TEXT PRIMARY KEY,
        top_concerns JSONB NOT NULL DEFAULT ` (1)

- [rawSql] `nest/src/database/migrations/1746000410000-DiagnosisReport.ts:13`
  ```ts
  await queryRunner.query(`
  ```

## `CREATE INDEX IF NOT EXISTS idx_diagnosis_report_created_at ON diagnosis_report (created_at)` (1)

- [rawSql] `nest/src/database/migrations/1746000410000-DiagnosisReport.ts:22`
  ```ts
  await queryRunner.query(
  ```

## `DROP TABLE IF EXISTS diagnosis_report` (1)

- [rawSql] `nest/src/database/migrations/1746000410000-DiagnosisReport.ts:28`
  ```ts
  await queryRunner.query(`DROP TABLE IF EXISTS diagnosis_report`);
  ```

## `
      INSERT INTO recommendation_catalog
        (id, version, category, display_text_short_pt, display_text_long_pt,
         priority_default, effort_estimate, risk_level, requires_professional,
         professional_type, invasiveness_level, evidence_level, created_at)
      VALUES
        (` (1)

- [rawSql] `nest/src/database/migrations/1746000420000-M56bAestheticProcedures.ts:30`
  ```ts
  await queryRunner.query(`
  ```

## `
      INSERT INTO recommendation_trigger
        (recommendation_id, metric_id, severity, direction, created_at)
      VALUES
        (` (1)

- [rawSql] `nest/src/database/migrations/1746000420000-M56bAestheticProcedures.ts:98`
  ```ts
  await queryRunner.query(`
  ```

## `DELETE FROM recommendation_catalog WHERE id = ANY($1)` (1)

- [rawSql] `nest/src/database/migrations/1746000420000-M56bAestheticProcedures.ts:139`
  ```ts
  await queryRunner.query(
  ```

## `
          INSERT INTO metric_content
            (metric_id, locale, feynman_text, description, how_measured,
             ranges_text, common_issues, ` (1)

- [rawSql] `nest/src/database/migrations/1746000430000-M66RemapMetricContentIds.ts:107`
  ```ts
  await queryRunner.query(
  ```

## `DELETE FROM metric_content WHERE metric_id = ANY($1)` (1)

- [rawSql] `nest/src/database/migrations/1746000430000-M66RemapMetricContentIds.ts:125`
  ```ts
  await queryRunner.query(
  ```

## `
      SELECT md.metric_id,
             COALESCE(md.display_name->>` (1)

- [rawSql] `nest/src/database/migrations/1746000440000-M53cTemplateBackfill.ts:82`
  ```ts
  const rows: Array<{ metric_id: string; pt_label: string }> = await queryRunner.query(`
  ```

## `INSERT INTO diagnostic_template
           (version, metric_id, severity, direction, size, template_pt, placeholders_used)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
         ON CONFLICT ON CONSTRAINT uq_diagnostic_template_lookup DO NOTHING` (1)

- [rawSql] `nest/src/database/migrations/1746000440000-M53cTemplateBackfill.ts:116`
  ```ts
  await queryRunner.query(
  ```

## `
        SELECT md.metric_id,
               COALESCE(md.display_name->>` (1)

- [rawSql] `nest/src/database/migrations/1746000450000-M66bMetricContentBackfill.ts:77`
  ```ts
  await queryRunner.query(`
  ```

## `INSERT INTO ideals_version(version, description, is_active, created_at)
       VALUES ($1, $2, false, now())
       ON CONFLICT (version) DO NOTHING` (1)

- [rawSql] `nest/src/database/migrations/1746000460000-M67RecalibrateMetricIdeals.ts:105`
  ```ts
  await queryRunner.query(
  ```

## `UPDATE ideals_version SET is_active = false WHERE is_active = true AND version <> $1` (1)

- [rawSql] `nest/src/database/migrations/1746000460000-M67RecalibrateMetricIdeals.ts:162`
  ```ts
  await queryRunner.query(`UPDATE ideals_version SET is_active = false WHERE is_active = true AND version <> $1`, [NEW_VERSION]);
  ```

## `UPDATE ideals_version SET is_active = false WHERE version = $1` (1)

- [rawSql] `nest/src/database/migrations/1746000460000-M67RecalibrateMetricIdeals.ts:168`
  ```ts
  await queryRunner.query(`UPDATE ideals_version SET is_active = false WHERE version = $1`, [NEW_VERSION]);
  ```

## `DELETE FROM metric_ideal WHERE ideals_version = $1` (1)

- [rawSql] `nest/src/database/migrations/1746000460000-M67RecalibrateMetricIdeals.ts:170`
  ```ts
  await queryRunner.query(`DELETE FROM metric_ideal WHERE ideals_version = $1`, [NEW_VERSION]);
  ```

## `DELETE FROM ideals_version WHERE version = $1` (1)

- [rawSql] `nest/src/database/migrations/1746000460000-M67RecalibrateMetricIdeals.ts:171`
  ```ts
  await queryRunner.query(`DELETE FROM ideals_version WHERE version = $1`, [NEW_VERSION]);
  ```

## `versionRepo` (1)

- [repository] `nest/src/modules/admin/admin-blacklist.service.ts:28`
  ```ts
  return this.versionRepo.find({ order: { version: 'ASC' } });
  ```

## `
      SELECT md.metric_id, md.display_name->>` (1)

- [rawSql] `nest/src/modules/admin/admin-metric-ideal.service.ts:41`
  ```ts
  const rows = await this.dataSource.query(`
  ```

## `registryVersionRepo` (1)

- [repository] `nest/src/modules/analysis/domain/orchestrator.service.ts:126`
  ```ts
  this.registryVersionRepo.findOne({ where: { isActive: true } }),
  ```

## `idealsVersionRepo` (1)

- [repository] `nest/src/modules/analysis/domain/orchestrator.service.ts:127`
  ```ts
  this.idealsVersionRepo.findOne({ where: { isActive: true } }),
  ```

## `thresholdRepo` (1)

- [repository] `nest/src/modules/analysis/domain/orchestrator.service.ts:128`
  ```ts
  this.thresholdRepo.findOne({ where: { isActive: true } }),
  ```

## `collapseRepo` (1)

- [repository] `nest/src/modules/analysis/domain/orchestrator.service.ts:129`
  ```ts
  this.collapseRepo.findOne({ where: { isActive: true } }),
  ```

## `regionWeightsVersionRepo` (1)

- [repository] `nest/src/modules/analysis/domain/orchestrator.service.ts:130`
  ```ts
  this.regionWeightsVersionRepo.findOne({ where: { isActive: true } }),
  ```

## `globalWeightsVersionRepo` (1)

- [repository] `nest/src/modules/analysis/domain/orchestrator.service.ts:131`
  ```ts
  this.globalWeightsVersionRepo.findOne({ where: { isActive: true } }),
  ```

## `idealRepo` (1)

- [repository] `nest/src/modules/analysis/domain/orchestrator.service.ts:149`
  ```ts
  const ideals = await this.idealRepo.find({
  ```

## `regionWeightRepo` (1)

- [repository] `nest/src/modules/analysis/domain/orchestrator.service.ts:160`
  ```ts
  const rows = await this.regionWeightRepo.find({
  ```

## `globalWeightRepo` (1)

- [repository] `nest/src/modules/analysis/domain/orchestrator.service.ts:178`
  ```ts
  const rows = await this.globalWeightRepo.find({
  ```

## `regionalRepo` (1)

- [repository] `nest/src/modules/analysis/domain/report-reader.service.ts:129`
  ```ts
  this.regionalRepo.find({
  ```

## `globalRepo` (1)

- [repository] `nest/src/modules/analysis/domain/report-reader.service.ts:135`
  ```ts
  this.globalRepo.findOne({
  ```

## `againstIdealRepo` (1)

- [repository] `nest/src/modules/analysis/domain/report-reader.service.ts:143`
  ```ts
  ? await this.againstIdealRepo.find({
  ```

## `md` (1)

- [queryBuilder] `nest/src/modules/catalog/catalog.service.ts:153`
  ```ts
  .createQueryBuilder('md')
  ```

## `reportRepository` (1)

- [repository] `nest/src/modules/diagnosis/diagnosis.service.ts:42`
  ```ts
  const row = await this.reportRepository.findOne({ where: { runId } });
  ```

## `templateRepository` (1)

- [repository] `nest/src/modules/diagnosis/diagnosis.service.ts:146`
  ```ts
  const template = await this.templateRepository.findOne({ where: { id } });
  ```

## `evalAgainstIdealRepo` (1)

- [repository] `nest/src/modules/diagnosis/diagnostic-priority.service.ts:204`
  ```ts
  ? await this.evalAgainstIdealRepo.find({ where: { id: In(allAgainstIdealIds) } })
  ```

## `catalogRepo` (1)

- [repository] `nest/src/modules/diagnosis/diagnostic-priority.service.ts:218`
  ```ts
  ? await this.catalogRepo.find({ where: { id: In(recIds) } })
  ```

## `c` (1)

- [queryBuilder] `nest/src/modules/diagnosis/narrative.service.ts:394`
  ```ts
  .createQueryBuilder('c')
  ```

## `metricDefRepo` (1)

- [repository] `nest/src/modules/diagnosis/narrative.service.ts:152`
  ```ts
  const all = await this.metricDefRepo.find();
  ```

## `globalScoreRepo` (1)

- [repository] `nest/src/modules/diagnosis/narrative.service.ts:176`
  ```ts
  const globalScore = await this.globalScoreRepo.findOne({
  ```

## `templateRepo` (1)

- [repository] `nest/src/modules/diagnosis/narrative.service.ts:459`
  ```ts
  const template = await this.templateRepo.findOne({
  ```

## `catalogRepository` (1)

- [repository] `nest/src/modules/diagnosis/recommendation-catalog.service.ts:117`
  ```ts
  const recommendation = await this.catalogRepository.findOne({
  ```

## `triggerRepository` (1)

- [repository] `nest/src/modules/diagnosis/recommendation-catalog.service.ts:264`
  ```ts
  return this.triggerRepository.find({
  ```

## `catalogVersionRepo` (1)

- [repository] `nest/src/modules/diagnosis/recommendation-engine.service.ts:130`
  ```ts
  const activeVersion = await this.catalogVersionRepo.findOne({
  ```
