import {
  api,
  ChatMessageDTO,
  DinnerSessionDTO,
  DinnerStartResponse,
  GeneratedAssetDTO,
  MaterialDTO,
  MemberDTO,
  MemoryEventDTO,
  RelationDTO,
  RelationStatus,
  SpaceDTO,
  UserDTO,
} from './client';

export interface AuthResponse {
  token: string;
  user: UserDTO;
}

export const authApi = {
  register: (email: string, password: string, displayName: string) =>
    api.post<AuthResponse>('/auth/register', { email, password, displayName }).then((r) => r.data),
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }).then((r) => r.data),
  me: () => api.get<UserDTO>('/auth/me').then((r) => r.data),
};

export const spacesApi = {
  list: () => api.get<SpaceDTO[]>('/spaces').then((r) => r.data),
  create: (name: string) => api.post<SpaceDTO>('/spaces', { name }).then((r) => r.data),
  get: (id: string) =>
    api.get<SpaceDTO & { members: MemberDTO[] }>(`/spaces/${id}`).then((r) => r.data),
  update: (id: string, name: string) =>
    api.put<SpaceDTO>(`/spaces/${id}`, { name }).then((r) => r.data),
  remove: (id: string) => api.delete(`/spaces/${id}`).then((r) => r.data),
};

export const membersApi = {
  list: (spaceId: string) =>
    api.get<MemberDTO[]>(`/members/space/${spaceId}`).then((r) => r.data),
  create: (input: { spaceId: string; name: string; relation: string; description: string }) =>
    api.post<MemberDTO>('/members', input).then((r) => r.data),
  get: (id: string) => api.get<MemberDTO>(`/members/${id}`).then((r) => r.data),
  update: (id: string, input: { name?: string; relation?: string; description?: string }) =>
    api.put<MemberDTO>(`/members/${id}`, input).then((r) => r.data),
  remove: (id: string) => api.delete(`/members/${id}`).then((r) => r.data),
  generatePersonality: (id: string) =>
    api.post<MemberDTO>(`/members/${id}/personality`).then((r) => r.data),
  generateAvatar: (id: string) =>
    api.post<MemberDTO>(`/members/${id}/avatar`).then((r) => r.data),
  uploadPhoto: (id: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api
      .post<MaterialDTO>(`/members/${id}/materials/photo`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
  addText: (id: string, kind: 'text' | 'dialogue', textBody: string) =>
    api
      .post<MaterialDTO>(`/members/${id}/materials/text`, { kind, textBody })
      .then((r) => r.data),
};

export const dinnerApi = {
  start: (spaceId: string, mealType: 'breakfast' | 'lunch' | 'dinner') =>
    api.post<DinnerStartResponse>('/dinner/start', { spaceId, mealType }).then((r) => r.data),
  message: (spaceId: string, sessionId: string, content: string) =>
    api
      .post<{
        userTurn: { id: string; sequence: number };
        aiTurns: ChatMessageDTO[];
      }>('/dinner/message', { spaceId, sessionId, content })
      .then((r) => r.data),
  end: (sessionId: string) => api.post(`/dinner/${sessionId}/end`).then((r) => r.data),
  sessions: (spaceId: string) =>
    api.get<DinnerSessionDTO[]>(`/dinner/space/${spaceId}/sessions`).then((r) => r.data),
  detail: (sessionId: string) =>
    api
      .get<{ session: DinnerSessionDTO; messages: ChatMessageDTO[] }>(`/dinner/${sessionId}`)
      .then((r) => r.data),
};

export const assetsApi = {
  list: (memberId: string) =>
    api.get<GeneratedAssetDTO[]>(`/assets/member/${memberId}`).then((r) => r.data),
  generate: (
    memberId: string,
    body: { assetType: string; emotion?: string; size?: string },
  ) =>
    api
      .post<GeneratedAssetDTO>(`/assets/member/${memberId}/generate`, body)
      .then((r) => r.data),
  remove: (assetId: string) => api.delete(`/assets/${assetId}`).then((r) => r.data),
};

export interface RelationCreateInput {
  spaceId: string;
  fromMemberId: string;
  toMemberId: string;
  relationType: string;
  addressTerm: string;
  coAddressTerms?: string[];
  intimacy?: number;
  status?: RelationStatus;
  notes?: string;
}

export type RelationUpdateInput = Partial<Omit<RelationCreateInput, 'spaceId'>> & {
  spaceId: string;
};

export const relationsApi = {
  list: (spaceId: string) =>
    api.get<RelationDTO[]>(`/relations/space/${spaceId}`).then((r) => r.data),
  create: (input: RelationCreateInput) =>
    api.post<RelationDTO>('/relations', input).then((r) => r.data),
  update: (id: string, input: RelationUpdateInput) =>
    api.put<RelationDTO>(`/relations/${id}`, input).then((r) => r.data),
  remove: (id: string) => api.delete(`/relations/${id}`).then((r) => r.data),
};

export const memoryApi = {
  list: (spaceId: string) =>
    api.get<MemoryEventDTO[]>(`/memory/space/${spaceId}`).then((r) => r.data),
  remove: (id: string) => api.delete(`/memory/${id}`).then((r) => r.data),
};
