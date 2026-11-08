import { config } from './config';

export type DetectionStatus = 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type Verdict = 'REAL' | 'FAKE' | 'SUSPICIOUS';
export type FailureReason = 'NO_FACE_DETECTED' | 'VIDEO_NOT_SUPPORTED' | 'AI_SERVER_ERROR' | 'TIMEOUT';

export interface Evidence {
  type: string;
  description: string;
}

export interface Detection {
  detectionId: number;
  status: DetectionStatus;
  verdict: Verdict | null;
  confidence: number | null;
  riskScore: number | null;
  evidences: Evidence[];
  failureReason: FailureReason | null;
  band: 'LOW' | 'UNCERTAIN' | 'HIGH' | 'UNDETERMINED' | null;
  undeterminedReason: string | null;
  modelName: string | null;
}

export class SignalApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

// 비로그인 5회 제한은 서버가 X-Anonymous-Id 기준으로 센다. 디스코드 유저 단위로 묶는다.
const anonymousId = (discordUserId: string) => `discord:${discordUserId}`;

async function parseError(res: Response): Promise<SignalApiError> {
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return new SignalApiError(res.status, body?.message ?? `Signal 서버 오류 (${res.status})`);
}

export async function createDetection(discordUserId: string, file: Blob, filename: string): Promise<number> {
  const form = new FormData();
  form.append('file', file, filename);
  const res = await fetch(`${config.signalApiUrl}/api/v1/deepfake-detections`, {
    method: 'POST',
    headers: { 'X-Anonymous-Id': anonymousId(discordUserId) },
    body: form,
  });
  if (!res.ok) throw await parseError(res);
  return ((await res.json()) as { detectionId: number }).detectionId;
}

export async function getDetection(discordUserId: string, detectionId: number): Promise<Detection> {
  const res = await fetch(`${config.signalApiUrl}/api/v1/deepfake-detections/${detectionId}`, {
    headers: { 'X-Anonymous-Id': anonymousId(discordUserId) },
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as Detection;
}

export async function waitForDetection(
  discordUserId: string,
  detectionId: number,
  { intervalMs = 2000, timeoutMs = 90_000 } = {},
): Promise<Detection> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const detection = await getDetection(discordUserId, detectionId);
    if (detection.status !== 'PROCESSING') return detection;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new SignalApiError(408, '분석이 오래 걸리고 있어요. 잠시 후 다시 시도해 주세요.');
}
