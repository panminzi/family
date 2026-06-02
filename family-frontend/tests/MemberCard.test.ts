import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import MemberCard from '../src/components/MemberCard.vue';
import type { MemberDTO } from '../src/api/client';

const baseMember: MemberDTO = {
  id: 'm1',
  spaceId: 'sp1',
  name: '老王',
  relation: '爸爸',
  description: '幽默',
  personality: null,
  avatarUrl: null,
  createdAt: '2024-01-01T00:00:00Z',
};

describe('MemberCard', () => {
  it('shows initials when avatar missing', () => {
    const w = mount(MemberCard, { props: { member: baseMember } });
    expect(w.find('[data-test="avatar-placeholder"]').text()).toBe('老');
    expect(w.find('[data-test="avatar"]').exists()).toBe(false);
    expect(w.find('[data-test="no-personality"]').exists()).toBe(true);
  });

  it('renders avatar when set', () => {
    const m = { ...baseMember, avatarUrl: 'https://example.com/a.png' };
    const w = mount(MemberCard, { props: { member: m } });
    const img = w.find('[data-test="avatar"]');
    expect(img.exists()).toBe(true);
    expect(img.attributes('src')).toBe('https://example.com/a.png');
  });

  it('renders trait tags when personality present', () => {
    const m: MemberDTO = {
      ...baseMember,
      personality: {
        traits: ['幽默', '乐观'],
        speechStyle: '幽默',
        emotionTendency: '乐观',
        catchphrase: '哈',
        relationshipNotes: '',
      },
    };
    const w = mount(MemberCard, { props: { member: m } });
    const tags = w.find('[data-test="traits"]');
    expect(tags.exists()).toBe(true);
    expect(tags.text()).toContain('幽默');
    expect(tags.text()).toContain('乐观');
  });
});
