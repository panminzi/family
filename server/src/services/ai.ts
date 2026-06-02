// AI service abstraction.
// In production, an OpenAI implementation calls Chat Completions / Images.
// When OPENAI_API_KEY is missing, a deterministic stub is used so the system
// runs end-to-end without external dependency. Tests inject `setAiService`
// to assert call shapes without hitting the network.

export interface PersonalityProfile {
  traits: string[];
  speechStyle: string;
  emotionTendency: string;
  catchphrase: string;
  relationshipNotes: string;
}

export interface DialogueTurn {
  speaker: string;   // member display name
  memberId: string;  // member id
  content: string;
}

export interface DialogueGenInput {
  mealType: 'breakfast' | 'lunch' | 'dinner';
  members: Array<{
    id: string;
    name: string;
    relation: string;
    personality: PersonalityProfile | null;
  }>;
  history: Array<{ speaker: string; content: string }>;
  userTurn?: { content: string };
  rounds: number;
}

export interface AiService {
  extractPersonality(input: {
    name: string;
    relation: string;
    description: string;
    extraTexts: string[];
  }): Promise<PersonalityProfile>;

  generateAvatarUrl(input: {
    name: string;
    personality: PersonalityProfile;
    relation: string;
  }): Promise<string>;

  generateDialogue(input: DialogueGenInput): Promise<DialogueTurn[]>;
}

// ---------- stub implementation (no network) ----------

const stubService: AiService = {
  async extractPersonality({ name, relation, description }) {
    const traits = inferTraits(description);
    return {
      traits,
      speechStyle: traits.includes('幽默') ? '幽默' : '温和',
      emotionTendency: traits.includes('乐观') ? '乐观' : '中性',
      catchphrase: `${name}的口头禅`,
      relationshipNotes: `作为${relation}，与家人关系温暖。`,
    };
  },
  async generateAvatarUrl({ name }) {
    // Placeholder image — deterministic, embeddable.
    const text = encodeURIComponent(name);
    return `https://placehold.co/512x512/png?text=${text}`;
  },
  async generateDialogue({ members, mealType, rounds, userTurn }) {
    const turns: DialogueTurn[] = [];
    const meal = mealType === 'breakfast' ? '早餐' : mealType === 'lunch' ? '午餐' : '晚餐';
    for (let i = 0; i < rounds; i++) {
      const m = members[i % members.length];
      turns.push({
        speaker: m.name,
        memberId: m.id,
        content: `${m.name}：今天的${meal}真不错。`,
      });
    }
    if (userTurn) {
      const m = members[0];
      turns.push({
        speaker: m.name,
        memberId: m.id,
        content: `${m.name}：你说"${userTurn.content}"，我也这么觉得。`,
      });
    }
    return turns;
  },
};

function inferTraits(text: string): string[] {
  const out = new Set<string>();
  const t = text.toLowerCase();
  if (/(开心|乐观|爱笑|阳光)/.test(text)) out.add('乐观');
  if (/(幽默|搞笑|逗|爱开玩笑)/.test(text)) out.add('幽默');
  if (/(温柔|温和|耐心|细心)/.test(text)) out.add('温柔');
  if (/(严厉|严格|老派|传统)/.test(text)) out.add('严厉');
  if (/(爱吃|吃货|美食)/.test(text)) out.add('爱吃');
  if (out.size === 0) out.add('随和');
  void t;
  return Array.from(out);
}

// ---------- pluggable singleton ----------

let current: AiService = stubService;

export function getAiService(): AiService {
  return current;
}

export function setAiService(svc: AiService): void {
  current = svc;
}

export function resetAiService(): void {
  current = stubService;
}
