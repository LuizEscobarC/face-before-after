import { Module, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
class TrackingListener {
  private readonly logger = new Logger('TrackingListener');

  @OnEvent('photo.quality.rejected')
  onRejected(payload: unknown): void {
    this.logger.debug(`(stub) track rejection: ${JSON.stringify(payload)}`);
  }

  @OnEvent('photo.quality.accepted')
  onAccepted(payload: unknown): void {
    this.logger.debug(`(stub) track acceptance: ${JSON.stringify(payload)}`);
  }

  @OnEvent('analysis.completed')
  onCompleted(payload: unknown): void {
    this.logger.debug(`(stub) track completion: ${JSON.stringify(payload)}`);
  }
}

/**
 * TrackingModule — DDD stub. Futuro:
 *   - Persiste eventos do EventBus em storage (Postgres/Mongo) para analytics
 *   - Registra fingerprint vs grade ao longo do tempo
 */
@Module({
  providers: [TrackingListener],
})
export class TrackingModule {}
