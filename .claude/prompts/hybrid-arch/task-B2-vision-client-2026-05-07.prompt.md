# Task B2 — VisionClient + DTOs + /v1/vision/* Proxy Controller
**Created**: 2026-05-07
**Status**: ✅ CONCLUÍDO
**Stack**: NestJS 11, TypeScript ESM, axios

---

## 0. O que foi feito

Implementação do `VisionModule`: cliente HTTP (axios) que encapsula todas as chamadas ao `vision-service` FastAPI, DTOs com Swagger, e controller proxy que expõe os mesmos endpoints sob `/v1/vision`.

---

## 1. Arquivos criados

```
nest/src/modules/vision/
  vision.module.ts         ← providers: VisionClient + VISION_CLIENT_CONFIG token
  vision.controller.ts     ← 7 rotas em /v1/vision
  vision.client.ts         ← axios instance + métodos tipados
  vision.config.ts         ← VISION_CLIENT_CONFIG symbol + loadVisionClientConfig()
  dto/
    vision.dto.ts          ← todos os DTOs de request/response
```

---

## 2. `VisionClient` — métodos

```typescript
class VisionClient {
  health():                                 Promise<{status: string}>
  captureGuidelines():                      Promise<CaptureGuidelinesDto>
  landmarks(p: LandmarkRequestDto):         Promise<LandmarkResponseDto>
  metrics(p: MetricsRequestDto):            Promise<MetricsResponseDto>
  fullPipeline(p: FullPipelineRequestDto):  Promise<FullPipelineResponseDto>
  compare(p: CompareRequestDto):            Promise<Record<string, unknown>>
  fetchBinary(path):                        Promise<{data: Buffer, contentType: string}>
  fetchAnnotated(runId):                    Promise<{data: Buffer, contentType: string}>
  fetchSimulation(runId, simType):          Promise<{data: Buffer, contentType: string}>
}
```

### Configuração axios
```typescript
axios.create({
  baseURL: process.env.VISION_SERVICE_URL ?? 'http://vision-service:8000',
  timeout: parseInt(process.env.VISION_SERVICE_TIMEOUT_MS ?? '30000'),
  maxBodyLength: 60 * 1024 * 1024,  // 60MB
  maxContentLength: 60 * 1024 * 1024,
})
```

### Tratamento de erro upstream
`toHttpException()` em `VisionClient`:
- Status 4xx upstream → `HttpException` com mesmo status + payload normalizado
- Status 5xx → `ServiceUnavailableException`
- Timeout → `ServiceUnavailableException` com `VISION_TIMEOUT`
- **Bug corrigido**: quando `upstreamData instanceof ArrayBuffer || Buffer.isBuffer(upstreamData)` → decodifica UTF-8 → JSON.parse antes de montar o envelope de erro (evitava bytes opacos em error.details)

---

## 3. DTOs principais (`vision.dto.ts`)

| DTO | Campos relevantes |
|-----|-------------------|
| `LandmarkRequestDto` | `image_base64`, `session_id?` |
| `LandmarkResponseDto` | `session_id`, `landmarks[][]`, `pose`, `quality_score`, `quality_grade`, `flags`, `regional_penalties`, `recommendations`, `fingerprint`, `processing_mode`, `sharpness_score`, `lighting_asymmetry`, `subscore_breakdown` |
| `MetricsRequestDto` | `landmarks[][]`, `quality_context: {quality_score, regional_penalties}`, `image_base64?` |
| `FullPipelineRequestDto` | `image_base64`, `mode?: 'premium'|'teaser'`, `session_id?`, `filename?` |
| `FullPipelineResponseDto` | `run_id`, `output_dir`, `photo_url?`, `result` |
| `CompareRequestDto` | `run_id_before`, `run_id_after` |
| `CaptureGuidelinesDto` | `distance_meters`, `lighting`, `expression`, `angle_yaw_max`, `angle_pitch_max`, `angle_roll_max` |

**Bug corrigido**: `CaptureGuidelinesDto` precisava de `@ApiProperty({ type: String/Number })` explícitos — sem isso, Swagger causava erro de circular dependency em startup.

---

## 4. Controller `/v1/vision`

```
GET  /v1/vision/capture-guidelines
POST /v1/vision/landmarks
POST /v1/vision/metrics
POST /v1/vision/full-pipeline
POST /v1/vision/compare
GET  /v1/vision/results/:runId/annotated              → JPEG binário
GET  /v1/vision/results/:runId/simulation/:simType    → JPEG binário
```

Endpoints binários usam `@Res({ passthrough: false })` + `reply.header('Content-Type').send(buffer)` (Fastify).

---

## 5. `VISION_CLIENT_CONFIG` token

```typescript
// Injeção via Symbol para testabilidade
@Inject(VISION_CLIENT_CONFIG) config: VisionClientConfig

// Provider no módulo
{ provide: VISION_CLIENT_CONFIG, useFactory: loadVisionClientConfig }
```

---

## 6. Verificação

```bash
# Proxy landmarks
curl -s -X POST http://localhost:9020/v1/vision/landmarks \
  -H "Content-Type: application/json" \
  -d "{\"image_base64\":\"$(base64 -w0 bkp/antes.png)\"}" \
  | jq '{quality_grade, quality_score, fingerprint}'

# Proxy guidelines
curl http://localhost:9020/v1/vision/capture-guidelines | jq .

# Imagem anotada (retorna JPEG)
RUN_ID=$(curl -s -X POST http://localhost:9020/v1/vision/full-pipeline \
  -H "Content-Type: application/json" \
  -d "{\"image_base64\":\"$(base64 -w0 bkp/antes.png)\",\"mode\":\"premium\"}" \
  | jq -r '.run_id')
curl -s http://localhost:9020/v1/vision/results/$RUN_ID/annotated -o /tmp/annotated.jpg
file /tmp/annotated.jpg  # deve ser JPEG
```
