import { useBiometricExercise } from '../../biometric/useBiometricExercise';
import type { BiometricExerciseConfig } from '../../biometric/types';
import type { Pt } from '../../biometric/engine';
import { Wireframe } from './Wireframe';
import { Heatmap } from './Heatmap';
import './styles.css';

export type BiometricFaceSimulatorProps = {
  config: BiometricExerciseConfig;
  landmarks?: ReadonlyArray<Pt> | null;
  showCaption?: boolean;
  size?: number;
};

export function BiometricFaceSimulator({
  config,
  landmarks = null,
  showCaption = true,
  size = 280,
}: BiometricFaceSimulatorProps) {
  const { frames } = useBiometricExercise(config, landmarks ?? null);
  return (
    <div className="biometric-face-simulator" style={{ width: size }}>
      <div className="bfs-stage" style={{ width: size, height: size }}>
        <Wireframe config={config} landmarks={landmarks ?? null} />
        <Heatmap frames={frames} />
      </div>
      {showCaption && config.caption_pt && (
        <p className="bfs-caption">{config.caption_pt}</p>
      )}
    </div>
  );
}

export default BiometricFaceSimulator;
