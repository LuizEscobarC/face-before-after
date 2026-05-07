import { Module, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Injectable } from '@nestjs/common';

@Injectable()
class DiagnosisListener {
  private readonly logger = new Logger('DiagnosisListener');

  @OnEvent('analysis.completed')
  onAnalysisCompleted(payload: unknown): void {
    this.logger.debug(`(stub) diagnosing analysis: ${JSON.stringify(payload)}`);
  }
}

/**
 * DiagnosisModule — DDD stub. Futuro:
 *   - DiagnoseFaceUseCase reads metrics + builds Insight aggregate
 *   - Reage a evento `analysis.completed`
 */
@Module({
  providers: [DiagnosisListener],
})
export class DiagnosisModule {}
