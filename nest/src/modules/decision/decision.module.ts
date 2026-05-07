import { Module, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
class DecisionListener {
  private readonly logger = new Logger('DecisionListener');

  @OnEvent('analysis.compared')
  onCompared(payload: unknown): void {
    this.logger.debug(`(stub) deciding next steps: ${JSON.stringify(payload)}`);
  }
}

/**
 * DecisionModule — DDD stub. Futuro:
 *   - PrioritizeImprovementsUseCase (top_leverage.py)
 *   - Recomendações de tratamento.
 */
@Module({
  providers: [DecisionListener],
})
export class DecisionModule {}
