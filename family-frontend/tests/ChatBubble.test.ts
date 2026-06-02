import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ChatBubble from '../src/components/ChatBubble.vue';
import type { ChatMessageDTO } from '../src/api/client';

const baseMsg: ChatMessageDTO = {
  id: 'c1',
  sessionId: 's1',
  memberId: 'm1',
  speaker: '老王',
  content: '今天的菜真好吃',
  role: 'member',
  sequence: 1,
  createdAt: '2024-01-01T00:00:00Z',
};

describe('ChatBubble', () => {
  it('renders speaker and content', () => {
    const w = mount(ChatBubble, { props: { message: baseMsg } });
    expect(w.text()).toContain('老王');
    expect(w.text()).toContain('今天的菜真好吃');
    expect(w.classes()).not.toContain('user');
  });

  it('adds user class when role is user', () => {
    const m = { ...baseMsg, role: 'user' as const, speaker: '我', content: '我也觉得' };
    const w = mount(ChatBubble, { props: { message: m } });
    expect(w.classes()).toContain('user');
    expect(w.text()).toContain('我也觉得');
  });
});
