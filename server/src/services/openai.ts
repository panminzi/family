// OpenAI-backed AiService. Activated at boot when OPENAI_API_KEY is set.
// Tests never go down this path.

import OpenAI from 'openai';
import {
  AiService,
  DialogueGenInput,
  DialogueTurn,
  PersonalityProfile,
  setAiService,
} from './ai';

function buildOpenAIService(apiKey: string): AiService {
  const client = new OpenAI({ apiKey });

  return {
    async extractPersonality({ name, relation, description, extraTexts }) {
      const prompt = [
        '你是一名人格建模师。基于以下家庭成员资料，输出严格的 JSON：',
        '字段：traits(string[],3-5项)、speechStyle(string)、emotionTendency(string)、catchphrase(string)、relationshipNotes(string)。',
        `成员名: ${name}`,
        `家庭关系: ${relation}`,
        `描述: ${description}`,
        ...(extraTexts.length ? ['补充资料:', ...extraTexts] : []),
        '只返回 JSON，无任何额外文本。',
      ].join('\n');

      const resp = await client.chat.completions.create({
        model: process.env.OPENAI_TEXT_MODEL ?? 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });
      const raw = resp.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as Partial<PersonalityProfile>;
      return {
        traits: parsed.traits ?? ['随和'],
        speechStyle: parsed.speechStyle ?? '温和',
        emotionTendency: parsed.emotionTendency ?? '中性',
        catchphrase: parsed.catchphrase ?? '',
        relationshipNotes: parsed.relationshipNotes ?? '',
      };
    },

    async generateAvatarUrl({ name, personality, relation }) {
      const prompt = [
        'cute cartoon family member portrait, soft watercolor style, warm lighting,',
        `character: ${name}, family role: ${relation},`,
        `traits: ${personality.traits.join(', ')},`,
        'centered face, kind expression, pastel background, no text',
      ].join(' ');
      try {
        const img = await client.images.generate({
          model: process.env.OPENAI_IMAGE_MODEL ?? 'dall-e-3',
          prompt,
          n: 1,
          size: '1024x1024',
        });
        const url = img.data?.[0]?.url;
        if (url) return url;
      } catch (_e) {
        // fall through to placeholder
      }
      return `https://placehold.co/512x512/png?text=${encodeURIComponent(name)}`;
    },

    async generateDialogue(input: DialogueGenInput): Promise<DialogueTurn[]> {
      const members = input.members.map((m) => ({
        id: m.id,
        name: m.name,
        relation: m.relation,
        traits: m.personality?.traits.join('、') ?? '随和',
        style: m.personality?.speechStyle ?? '温和',
        catchphrase: m.personality?.catchphrase ?? '',
      }));

      const meal =
        input.mealType === 'breakfast' ? '早餐' : input.mealType === 'lunch' ? '午餐' : '晚餐';

      const sys = [
        '你是家庭对话剧情设计师。基于成员人格，写一段自然口语的多人饭桌对话。',
        '硬约束：',
        '1. 输出严格 JSON：{"turns":[{"memberId":"...","content":"..."}, ...]}',
        '2. memberId 只能取下列成员 id 之一。',
        '3. 风格符合每个人的 traits 与 speechStyle。',
        `4. 围绕${meal}话题展开，气氛轻松温暖。`,
      ].join('\n');

      const user = JSON.stringify({
        members,
        history: input.history,
        userTurn: input.userTurn ?? null,
        rounds: input.rounds,
      });

      const resp = await client.chat.completions.create({
        model: process.env.OPENAI_TEXT_MODEL ?? 'gpt-4o-mini',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.9,
      });
      const raw = resp.choices[0]?.message?.content ?? '{"turns":[]}';
      const parsed = JSON.parse(raw) as { turns?: Array<{ memberId: string; content: string }> };
      const memById = new Map(input.members.map((m) => [m.id, m]));
      const out: DialogueTurn[] = [];
      for (const t of parsed.turns ?? []) {
        const m = memById.get(t.memberId);
        if (!m) continue;
        out.push({ memberId: m.id, speaker: m.name, content: t.content });
      }
      return out;
    },
  };
}

export function activateOpenAiServiceIfConfigured(apiKey: string | null): boolean {
  if (!apiKey) return false;
  setAiService(buildOpenAIService(apiKey));
  return true;
}
