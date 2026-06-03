import axios, { AxiosInstance } from 'axios';

const baseURL = import.meta.env.VITE_API_BASE ?? '/api';

export const api: AxiosInstance = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem('token');
      // soft redirect — full reload to clear state
      if (typeof window !== 'undefined' && !window.location.pathname.endsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  },
);

export interface UserDTO {
  id: string;
  email: string;
  displayName: string;
}

export interface SpaceDTO {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

export interface PersonalityDTO {
  traits: string[];
  speechStyle: string;
  emotionTendency: string;
  catchphrase: string;
  relationshipNotes: string;
}

export interface MemberDTO {
  id: string;
  spaceId: string;
  name: string;
  relation: string;
  description: string;
  personality: PersonalityDTO | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface MaterialDTO {
  id: string;
  memberId: string;
  kind: 'photo' | 'text' | 'dialogue';
  filePath: string | null;
  textBody: string | null;
}

export interface ChatMessageDTO {
  id: string;
  sessionId: string;
  memberId: string | null;
  speaker: string;
  content: string;
  role: 'member' | 'user';
  sequence: number;
  createdAt: string;
}

export interface DinnerSessionDTO {
  id: string;
  spaceId: string;
  mealType: 'breakfast' | 'lunch' | 'dinner';
  startedAt: string;
  endedAt: string | null;
  triggerInfo?: string | null;
}

export interface GeneratedAssetDTO {
  id: string;
  memberId: string;
  assetType: string;
  imageUrl: string;
  isPlaceholder: boolean;
  prompt: string;
  seed: number | null;
  service: string;
  cost: number | null;
  createdAt: string;
  updatedAt: string;
}

export type RelationStatus = 'active' | 'deceased' | 'estranged';

export interface RelationDTO {
  id: string;
  spaceId: string;
  fromMemberId: string;
  toMemberId: string;
  relationType: string;
  addressTerm: string;
  coAddressTerms: string[];
  intimacy: number;
  status: RelationStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryEventDTO {
  id: string;
  spaceId: string;
  subjectMemberId: string;
  scope: 'weekly' | 'monthly' | string;
  periodStart: string;
  periodEnd: string;
  summary: string;
  emotion?: string | null;
  tags?: string | null;
  involvedMemberIds?: string | null;
  importance?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface TriggerHitDTO {
  triggerId: string;
  sceneId: string;
}

export interface DinnerStartResponse {
  sessionId: string;
  turns: ChatMessageDTO[];
  trigger?: TriggerHitDTO | null;
  overlays?: TriggerHitDTO[];
}
