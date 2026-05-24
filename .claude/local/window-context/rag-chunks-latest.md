# RAG Chunks — última recuperação
**Timestamp:** 2026-05-24 05:19:50  |  **Project:** neo-backend  |  **Query:** entenda a linha cronologica dos prs dos planos oq foi implementado, se no código mudou, ajuste todos os prs para ficar r

[1] (score=0.78) (source=edited-file)
Um PR pode tocar múltiplos subsistemas — gere updates para cada um, mas mantenha cada doc focado em um só.

[2] (score=0.78) (source=edited-file)
// migrate-chunks-v2 foi removido do pipeline default: ele opera sobre o schema
// legado pré-multitenant. Para reingest limpa pós-mudança de schema, basta
// purge total + ingest-all.
type Step = { name: string; script: string; skipKey: string };

[3] (score=0.77) (source=edited-file)
| Subsistema | Pasta | Cobertura | Status |
|---|---|---|---|
| **sira** | [[sira/index]] | BM25 real, corpus stats, vocab expansion, lexical sketch, auditabilidade | em evolução (PR1+PR2 prontos, PR3+PR4 planejados) |
| **temporal** | [[temporal/index]] | Consciência temporal: `time_bucket`, `valid_from/to`, `:TimeBucket` graph | PR1-Temporal + PR2-Temporal prontos; PR3/PR4 planejados |
| **rag** | _(a criar conforme demanda)_ | Retrieval geral: dense, sparse, RRF, reranker, multi-query, RAPTOR, GraphRAG (Fase 7) | — |
| **ingest** | _(a criar conforme demanda)_ | Chunker, enricher, writer, scripts ingest-* | — |
| **llm** | _(a criar conforme demanda)_ | OpenRouter, fallback chain, gpu-worker | — |
| **gpu-worker** | [[gpu-worker/index]] | Servidor Windows para embedding/reranking via Di

[4] (score=0.77) (source=edited-file)
Mapeie cada arquivo modificado/criado para o subsistema dele. Use um destes critérios, na ordem:

[5] (score=0.78) (source=code-php, module=energy, class=DailyStrategy, method=postProcessEquipment)
// class DailyStrategy
/**
     * Pós-processa equipamento daily
     *
     * Daily tem lógicas especiais:
     * - Recalcula consumo total a partir de dados de consumo
     * - Estima para 24h se for hoje
     * - Converte unidades (W para KW)
     * - Calcula fator de carga
     * - Gera dados incrementais
     */

    public function postProcessEquipment(
        mixed $equipment,
        mixed $setup,
        mixed $dataVariation
    ): mixed {

        // Estima para 24h se for hoje
        if ($this->start->copy()->format('Y-m-d') == now()->format('Y-m-d')) {
            $estimado = ($equipment->consumo_total / $this->getElapsedHours()) * 24;
            $equipment->consumo_estimado = $estimado;
        } else {
            $equipment->consumo_estimado = $equipment->consumo_total;
        }

        // Recalcula variação e médias com novo consumo estimado

        if(is_null($dataVariation)){$dataVariation = collect();}
        
        $equipment->variacao = $dataVariation->first()->total_consumo ?? 0 > 0 ? (($equipment->consumo_estimado / $dataVariation->first()->total_consumo)-1) * 100 : null;
        $equipment->consumo_anterior = $dataVariation->first()->total_consumo ?? 0;
        $equipment->media_anterior = $dataVariation->first()->total_consumo ?? 0;

        // Converte unidades (W para KW)
        $dm = Helper::converterWToKW($equipment->media, $setup->id_unidade_medida, 'diario');
        //$equipment->demanda_max = Helper::converterWToKW($equipment->demanda_max, $setup->id_unidade_medida, 'diario');
        //$equipment->demanda_min = Helper::converterWToKW($equipment->demanda_min, $setup->id_unidade_medida, 'diario');
        $equipment->fator_carga = $equipment->demanda_max > 0 ? $dm / $equipment->demanda_max : null;

        // Gera dados incrementais
        $equipment->incremental_data = $this->incrementalData($this->data);

        return $equipment;
    }

    /**
     * Calcula demanda com ajuste de intervalo
     *
     * Se intervalo < 60 min, normaliza demanda multiplicando pelo fator
     */

[6] (score=0.77) (source=edited-file)
1. **Verifique se a pasta existe**: `[base]/[subsistema]/`. Se não, crie.
2. **Atualize `00-index.md`** (cria se não existir): overview do subsistema + tabela de docs.
3. **Atualize os arquivos relevantes** (01-architecture, 02-decisions, etc.) — não crie sem necessidade.
4. **Sempre atualize `99-changelog.md`**: uma linha datada por PR.
5. **Se `SUPPORTS_OBSIDIAN=yes`**: bump `updated_at` em todo arquivo editado; emita frontmatter em arquivos novos.

[7] (score=0.78) (source=md, module=reports)
### 4.3 Janela de processamento

```
(sem --date) hoje=2026-04-23 → inicio=2026-04-01, fim=2026-04-22 (mês corrente até ontem)
--date=2026-04-01            → inicio=2026-03-01, fim=2026-03-31 (março completo)
```

**Truque de backfill:** para processar março completo, passar `--date=2026-04-01`.

[8] (score=0.77) (source=code-php, module=energy, class=BasePeriodStrategy, method=postProcessEquipment)
// class BasePeriodStrategy
/**
     * Pós-processa equipamento (implementação padrão)
     *
     * A maioria das estratégias não precisa fazer nada especial
     */

    public function postProcessEquipment(
        mixed $equipment,
        mixed $setup,
        mixed $dataVariation
    ): mixed {
        return $equipment;
    }

    /**
     * Agrupa dados de acordo com atributos binários de forma intercalada
     *
     * Ex: se o atributo 'instalacao_aberta' do primeiro elemento da collection for '0' até mudar para '1' vai armazenar em uma collection,
     * quando mudar para '1' armazena em outra collectio e assim sucessivamente
     */

[9] (score=0.78) (source=md, module=reports)
## Gap de Dados — Jan/Feb/Mar 2026

**Não é bug de código.** O endpoint está correto — lê exatamente o que está na tabela.

O cron `dados:fotovoltaica-dados-anual` só processa do `startOfMonth()` até ontem. Para backfill de meses passados, ver `07-background-annual-photovoltaic-pipeline.md` seção 7:

```bash

[10] (score=0.78) (source=code-php, class=DashboardArCondicionadoService, method=getPeriodoAnterior)
// class DashboardArCondicionadoService

    public function getPeriodoAnterior($periodo)
    {
        return match ($periodo) {
            'ultimas1d' => Carbon::yesterday()->endOfDay()->subHours(48)->addSecond(),
            'ultimas2d' => Carbon::yesterday()->endOfDay()->subDays(4)->addSecond(),
            'ultimas7d' => Carbon::yesterday()->endOfDay()->subDays(14)->addSecond(),
            'ultimas14d' => Carbon::yesterday()->endOfDay()->subDays(28)->addSecond(),
            'ultimas30d' => Carbon::yesterday()->endOfDay()->subDays(60)->addSecond(),
            default => Carbon::yesterday()->endOfDay()->subDays(14)->addSecond(),
        };
    }

[11] (score=0.77) (source=edited-file)
Implementar seguindo os steps do `.prompt.md` na ordem exata. Usar as skills do projeto quando matcharem capability; caso contrário, inline.

[12] (score=0.78) (source=md, module=energy)
#### **2. Em `getFullRanking()` - INCONSISTÊNCIA ❌**

[EnergyDataProvider::getFullRanking()](app/Modules/Report/Infrastructure/Builders/Energy/EnergyDataProvider.php#L350)

```php
// Linha 361-366: Prepara hierarquia específica FP (como em getSummaryData)
$metersFpValidEquipments = $energyConsumptionRepository
    ->filterMetersEspecificFpUsecaseValidEquipments($installations);
$installationsFpHierarchyWithEquipments = $energyConsumptionRepository
    ->getInstallationsWithEspecificFpEquipments(
        $installations,
        $metersFpValidEquipments
    );

// ... mas depois em getFullRanking()...

// Linha 588-590: NÃO USA - PASSA HIERARQUIA PADRÃO INCORRETAMENTE
BreakdownRankingSlugEnum::LOW_POWER_FACTOR => $energyConsumptionRepository
    ->calcLowPowerFactorRankingPerInstallation(
        $installationsWithEquipments,  // ❌ USA HIERARQUIA PADRÃO (COM SETORIZADOS)
        $dailyDataCollection, $startDate, $endDate, limit: 0
    ),
```

**Status:** ❌ INCONSISTÊNCIA CRÍTICA
- Variável `$installationsFpHierarchyWithEquipments` é preparada mas **NUNCA USADA**
- O método recebe `$installationsWithEquipments` (hierarquia padrão com setorizados)
- Deveria receber `$installationsFpHierarchyWithEquipments` (apenas concessionaire + 1 QGBT)

---

[13] (score=0.77) (source=md, module=reports)
## Ordem sugerida de implementação

1. **Sprint 1 (backend puro, sem reunião):** Ajustes 5, 7, 9 — apenas DTO + repository, sem dependências
2. **Sprint 2 (backend + regra de negócio):** Ajustes 1, 9 refinamento (limites por equipamento)
3. **Sprint 3 (dados + frontend):** Ajustes 3, 4, 6, 8
4. **✅ RESOLVIDO:** Ajuste 2 — comportamento correto, sem ação necessária

[14] (score=0.77) (source=md, module=energy)
#### **1. Em `getSummaryData()` - CORRETO ✅**

[EnergyDataProvider::getSummaryData()](app/Modules/Report/Infrastructure/Builders/Energy/EnergyDataProvider.php#L130)

```php
// Linha 135-140: Prepara hierarquia específica FP
$metersFpValidEquipments = $energyConsumptionRepository
    ->filterMetersEspecificFpUsecaseValidEquipments($installations);
$installationsFpHierarchyWithEquipments = $energyConsumptionRepository
    ->getInstallationsWithEspecificFpEquipments(
        $installations,
        $metersFpValidEquipments
    );

// Linha 425-427: USA CORRETAMENTE a hierarquia específica FP
$lowPowerFactorRanking = $energyConsumptionRepository->calcLowPowerFactorRankingPerInstallation(
    $installationsFpHierarchyWithEquipments,  // ✅ Passa instâncias com medidores FP
    $dailyDataCollection, $startDate, $endDate
);
```

**Status:** ✅ CORRETO - Usa variável `$installationsFpHierarchyWithEquipments` preparada

---

[15] (score=0.77) (source=md)
### `Services\Modulos\Monitoramento\Agua\Strategies\HistoricalExpandedFlowProcessorStrategy::processHistoric`

**File:** `app/Services/Modulos/Monitoramento/Agua/Strategies/HistoricalExpandedFlowProcessorStrategy.php:52`

**SQL signals detected:** `->groupBy(`

**Method body (raw):**

```php
public function processHistoric(
        $installations,
        Carbon $startDate,
        Carbon $endDate,
        UnidadeAguaEnum $unitUserWantToSee = UnidadeAguaEnum::LITROS
    ): array {
        $equipmentsId = $installations->pluck('equipamentos')->flatten()->pluck('id')->toArray();

        $decimalPlace = $this->getDecimalPlaceFromInstallations($installations);

        $data = $this->getFlowDiaryData($startDate, $endDate, $equipmentsId);

        $groupedData = $data->map(function ($dataPerEquipment) use ($installations, $unitUserWantToSee) {
            return $dataPerEquipment->map(function ($item) use ($installations, $unitUserWantToSee) {
                $flowSetup = $installations->pluck('equipamentos')->flatten()
                    ->firstWhere('id', $item->id_equipamento)
                    ?->setups
                    ->firstWhere('tag_variavel', 'vazao');
                $equipmentUnit = $flowSetup->id_unidade_medida ?? UnidadeAguaEnum::LITROS->value;

                return [
                    'date' => $item->data_referencia,
                    'vazao_total' => UnidadeAguaEnum::convertWaterConsumption(
                        $item->vazao_total ?? 0,
                        $unitUserWantToSee->value,
                        $equipmentUnit,
                    ),
                    'vazao_media' => UnidadeAguaEnum::convertWaterConsumption(
                        $item->vazao_media ?? 0,
                        $unitUserWantToSee->value,
                        $equipmentUnit,
                    ),
                    'vazao_min' => UnidadeAguaEnum::convertWaterConsumption(
                        $item->vazao_min ?? 0,
                        $unitUserWantToSee->value,
                        $equipmentUnit,
                    ),
                    'vazao_max' => UnidadeAguaEnum::convertWaterConsumption(
                        $item->vazao_max ?? 0,
                        $unitUserWantToSee->value,
                        $equipmentUnit,
                    ),
                    'casas_decimais_vazao' => $flowSetup?->casas_decimais ?? 2,
                ];
            });
        })->flatten(1);

        $dataByDay = $groupedData->groupBy('date')->map(function ($dataPerDay) {
            return [
                'date' => $dataPerDay->first()['date'],
                'total_flow' => $dataPerDay->sum('vazao_total'),
                'average_flow' => $dataPerDay->avg('vazao_media'),
                'maximum_flow' => $dataPerDay->max('vazao_max'),
                'casas_decimais_vazao' => $dataPerDay->first()['casas_decimais_vazao'] ?? 2,
            ];
        });

        $processedData = collect();
        $currentDate = $startDate->copy();

        while ($currentDate <= $endDate) {
            $dateStr = $currentDate->format('Y-m-d');
            $dayData = $dataByDay->get($dateStr);

            if ($dayData) {
                $processedData->push($dayData);
            } else {
                $processedData->push([
                    'date' => $dateStr,
                    'total_flow' => null,
                    'average_flow' => null,
                    'maximum_flow' => null,
                    'casas_decimais_vazao' => $decimalPlace,
                ]);
            }

            $currentDate->addDay();
        }

        $daysDifference = $startDate->diffInDays($endDate);
        $period = match (true) {
            $daysDifference <= 3 => '3d',
            $daysDifference <= 7 => '7d',
            $daysDifference <= 14 => '14d',
            $daysDifference <= 31 => '30d',
            default => $daysDifference.'d'
        };

        return [
            'period' => $period,
            'unit' => [
                'id' => $unitUserWantToSee->value,
                'unit' => $unitUserWantToSee->getLabel(),
            ],
            'decimal_places' => $decimalPlace,
            ...$this->summarize($processedData->toArray(), new \stdClass, $endDate, '7d', null),
        ];
    }
```
