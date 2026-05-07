import { Injectable } from '@nestjs/common';

interface StorageDecisionInput {
  userConsented: boolean;
  purpose: 'quality-validation' | 'analysis' | 'audit';
}

@Injectable()
export class PhotoStoragePolicy {
  shouldStore({ userConsented, purpose }: StorageDecisionInput): boolean {
    // Raw photo bytes reach MinIO only when the user explicitly consented.
    // quality-validation never needs persistent storage (result is a LandmarkPayload, not the image).
    if (purpose === 'quality-validation') return false;
    return userConsented;
  }
}
