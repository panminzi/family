// OpenAI-backed AiService. Activated at boot when OPENAI_API_KEY is set.
// Tests never go down this path.

import OpenAI from 'openai';
import {
  AiService,
  AssetGenInput,
  AssetGenResult,
  DialogueGenInput,
  DialogueTurn,
  PersonalityProfile,
  setAiService,
} from './ai';

function buildOpenAIService(apiKey: string, baseURL?: string | null): AiService {
  const client = new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });

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
        'masterpiece, best quality, Studio Ghibli style, warm color palette,',
        'soft watercolor texture, hand-drawn, cozy atmosphere, thick line art,',
        'anime illustration, gentle warm lighting, family-friendly, wholesome,',
        `a cartoon family member portrait, role: ${relation}, name hint: ${name},`,
        `traits: ${personality.traits.join(', ')},`,
        'centered face, kind expression, soft pastel background, no text, no watermark',
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

    async generateAsset(input: AssetGenInput): Promise<AssetGenResult> {
      const prompt = buildAssetPrompt(input);
      const size = sizeFor(input.assetType, input.size);
      try {
        const img = await client.images.generate({
          model: process.env.OPENAI_IMAGE_MODEL ?? 'dall-e-3',
          prompt,
          n: 1,
          size: size as any,
        });
        const url = img.data?.[0]?.url;
        if (url) {
          return { imageUrl: url, isPlaceholder: false, prompt, service: 'openai', seed: input.seed };
        }
      } catch (_e) {
        /* fall through to placeholder */
      }
      const [w, h] = size.split('x');
      return {
        imageUrl: `https://placehold.co/${w}x${h}/png?text=${encodeURIComponent(`${input.name}_${input.assetType}`)}`,
        isPlaceholder: true,
        prompt,
        service: 'openai-fallback',
      };
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
        input.systemPrompt ?? '',
        '你是家庭对话剧情设计师。基于成员人格，写一段自然口语的多人饭桌对话。',
        '硬约束：',
        '1. 输出严格 JSON：{"turns":[{"memberId":"...","content":"..."}, ...]}',
        '2. memberId 只能取下列成员 id 之一。',
        '3. 风格符合每个人的 traits 与 speechStyle。',
        `4. 围绕${meal}话题展开，气氛轻松温暖。`,
        input.sceneInjection ? `5. 场景上下文：${input.sceneInjection}` : '',
        input.openingHook ? `6. 第一句对话尽量自然引出"${input.openingHook}"。` : '',
        input.props && input.props.length
          ? `7. 桌上/场景里出现的道具：${input.props.join('、')}（可作为话题素材，但不要罗列清单）。`
          : '',
      ]
        .filter(Boolean)
        .join('\n');

      const user = JSON.stringify({
        members,
        history: input.history,
        memory: input.memoryBlock ?? null,
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

function buildAssetPrompt(input: AssetGenInput): string {
  const persona = input.personality;
  const role = input.relation;
  const traits = persona?.traits.join(', ') ?? 'kind';
  const styleAnchor =
    'masterpiece, best quality, Studio Ghibli style, warm color palette, soft watercolor texture, hand-drawn, cozy atmosphere, thick line art, anime illustration, gentle warm lighting, family-friendly, wholesome';
  const negative =
    'photorealistic, realistic photo, 3D render, CGI, hyperrealism, horror, scary, creepy, dark atmosphere, blood, violence, nsfw, sexy, sexual, revealing clothes, low cut, extra fingers, extra limbs, deformed hands, mutated, bad anatomy, text, watermark, logo, signature, blurry, low quality, worst quality, jpeg artifacts, cropped face, off-center';
  const pose = poseBlock(input.assetType);
  const emotion = emotionBlock(input.assetType, input.emotion);
  return [
    styleAnchor,
    `a ${role} cartoon character, name hint: ${input.name},`,
    `traits: ${traits},`,
    pose,
    emotion,
    'centered composition, full character visible, single character only, clean background, soft warm light',
    `Negative: ${negative}, multiple people, crowd, twins`,
  ]
    .filter(Boolean)
    .join('\n');
}

function poseBlock(assetType: string): string {
  if (assetType === 'avatar') return 'head and shoulders portrait, looking at viewer, friendly';
  if (assetType === 'full_body')
    return 'full body shot, standing pose, hands relaxed at sides, three-quarter view';
  if (assetType === 'sitting')
    return 'sitting at dining table, holding chopsticks or bowl, side view, warm dinner scene';
  if (assetType.startsWith('emoji')) return 'simple chibi sticker, transparent friendly background';
  return '';
}

function emotionBlock(assetType: string, emotion?: string): string {
  if (!assetType.startsWith('emoji')) return '';
  const e = emotion ?? assetType.replace('emoji_', '');
  switch (e) {
    case 'happy':
      return 'big smile, eyes closed in joy, cheerful';
    case 'curious':
      return 'tilted head, raised eyebrow, hand on chin, questioning look';
    case 'serious':
      return 'calm composed face, slight frown, attentive eyes';
    case 'shy':
      return 'slight blush on cheeks, looking down, hand near face';
    case 'caring':
      return 'gentle warm smile, soft eyes, leaning forward';
    default:
      return 'gentle warm smile, soft eyes';
  }
}

function sizeFor(assetType: string, size?: string): string {
  if (size) return size;
  if (assetType === 'avatar') return '1024x1024';
  if (assetType === 'full_body') return '1024x1792';
  if (assetType === 'sitting') return '1024x1024';
  if (assetType.startsWith('emoji')) return '512x512';
  return '1024x1024';
}

export function activateOpenAiServiceIfConfigured(
  apiKey: string | null,
  baseURL?: string | null,
): boolean {
  if (!apiKey) return false;
  setAiService(buildOpenAIService(apiKey, baseURL));
  return true;
}
