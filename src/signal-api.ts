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

async function request<T>(
  discordUserId: string,
  path: string,
  init: { method?: string; body?: BodyInit; json?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'X-Anonymous-Id': anonymousId(discordUserId),
    'Accept-Language': 'ko',
  };
  let body = init.body;
  if (init.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.json);
  }
  const res = await fetch(`${config.signalApiUrl}${path}`, { method: init.method ?? 'GET', headers, body });
  if (!res.ok) throw await parseError(res);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export async function createDetection(discordUserId: string, file: Blob, filename: string): Promise<number> {
  const form = new FormData();
  form.append('file', file, filename);
  const res = await request<{ detectionId: number }>(discordUserId, '/api/v1/deepfake-detections', {
    method: 'POST',
    body: form,
  });
  return res.detectionId;
}

export function getDetection(discordUserId: string, detectionId: number): Promise<Detection> {
  return request(discordUserId, `/api/v1/deepfake-detections/${detectionId}`);
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

// ---- 위험도 진단 ----
export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface RiskAssessment {
  assessmentId: number;
  overallRiskLevel: RiskLevel;
  overallScore: number;
  factors: { type: string; label: string; score: number; description: string }[];
  recommendations: string[];
  faceDetected: boolean;
}

export function createRiskAssessment(discordUserId: string, file: Blob, filename: string): Promise<RiskAssessment> {
  const form = new FormData();
  form.append('image', file, filename);
  return request(discordUserId, '/api/v1/risk-assessments', { method: 'POST', body: form });
}

// ---- 기관 ----
export type SituationType = 'DEEPFAKE_IMAGE' | 'IMAGE_ABUSE' | 'CRISIS';

export interface Agency {
  agencyId: number;
  name: string;
  phone: string | null;
  website: string | null;
  availableHours: string | null;
  supportedActions: string[];
}

export async function getAgencies(discordUserId: string, situationType?: SituationType): Promise<Agency[]> {
  const query = situationType ? `?situationType=${situationType}` : '';
  const res = await request<{ agencies: Agency[] }>(discordUserId, `/api/v1/agencies${query}`);
  return res.agencies;
}

// ---- 상담 챗봇 ----
export interface ChatReply {
  reply: string;
  suggestedActions: string[];
  crisisDetected: boolean;
  recommendedAgencies: string[];
  sessionEnded: boolean;
  progress: { progressPercent: number; completedCount: number; totalCount: number };
}

export interface ChatSummary {
  situation: string;
  recommendedSteps: string[];
  riskLevel: RiskLevel;
  riskDescription: string;
  progressPercent: number;
}

export async function createChatSession(discordUserId: string): Promise<string> {
  const res = await request<{ sessionId: string }>(discordUserId, '/api/v1/chat/sessions', {
    method: 'POST',
    json: { saveConsent: false },
  });
  return res.sessionId;
}

export function sendChatMessage(discordUserId: string, sessionId: string, content: string): Promise<ChatReply> {
  return request(discordUserId, `/api/v1/chat/sessions/${sessionId}/messages`, { method: 'POST', json: { content } });
}

export function getChatSummary(discordUserId: string, sessionId: string): Promise<ChatSummary> {
  return request(discordUserId, `/api/v1/chat/sessions/${sessionId}/summary`);
}

export function deleteChatSession(discordUserId: string, sessionId: string): Promise<void> {
  return request(discordUserId, `/api/v1/chat/sessions/${sessionId}`, { method: 'DELETE' });
}
