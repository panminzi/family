// V0.2: directional family relation graph with hard constraints for prompt injection.
// 设计参考 MUL-33 §5.

import { getPrisma } from '../utils/prisma';

export type RelationType =
  | 'spouse_of'
  | 'parent_of'
  | 'child_of'
  | 'sibling_of'
  | 'grandparent_of'
  | 'grandchild_of'
  | 'extended_family_of';

export const RELATION_TYPES: RelationType[] = [
  'spouse_of',
  'parent_of',
  'child_of',
  'sibling_of',
  'grandparent_of',
  'grandchild_of',
  'extended_family_of',
];

export interface RelationRecord {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  relationType: RelationType;
  addressTerm: string;
  coAddressTerms: string[];
  intimacy: number;
  status: 'active' | 'deceased' | 'estranged';
  notes?: string | null;
}

export function relationLabel(t: RelationType): string {
  switch (t) {
    case 'spouse_of':
      return '配偶';
    case 'parent_of':
      return '父/母';
    case 'child_of':
      return '子/女';
    case 'sibling_of':
      return '兄弟姐妹';
    case 'grandparent_of':
      return '祖父母/外祖父母';
    case 'grandchild_of':
      return '孙/外孙';
    case 'extended_family_of':
      return '亲戚';
  }
}

export async function loadRelationsForSpace(spaceId: string): Promise<RelationRecord[]> {
  const prisma = getPrisma();
  const rows = await prisma.relation.findMany({ where: { spaceId } });
  return rows.map(rowToRelation);
}

export async function loadRelationsForMember(memberId: string): Promise<{
  outRelations: RelationRecord[];
  inRelations: RelationRecord[];
}> {
  const prisma = getPrisma();
  const [outRows, inRows] = await Promise.all([
    prisma.relation.findMany({ where: { fromMemberId: memberId } }),
    prisma.relation.findMany({ where: { toMemberId: memberId } }),
  ]);
  return {
    outRelations: outRows.map(rowToRelation),
    inRelations: inRows.map(rowToRelation),
  };
}

function rowToRelation(r: any): RelationRecord {
  let co: string[] = [];
  if (r.coAddressTerms) {
    try {
      const parsed = JSON.parse(r.coAddressTerms);
      if (Array.isArray(parsed)) co = parsed.filter((x) => typeof x === 'string');
    } catch {
      /* ignore */
    }
  }
  return {
    id: r.id,
    fromMemberId: r.fromMemberId,
    toMemberId: r.toMemberId,
    relationType: r.relationType as RelationType,
    addressTerm: r.addressTerm,
    coAddressTerms: co,
    intimacy: r.intimacy ?? 0.7,
    status: (r.status as RelationRecord['status']) ?? 'active',
    notes: r.notes ?? null,
  };
}

// Build the hard-constraint system-prompt block for one member, given the full
// member roster + relation graph. Output is ready to drop into a system message.
export function buildRelationPromptBlock(
  selfMemberId: string,
  members: Array<{ id: string; name: string; relation: string }>,
  relations: RelationRecord[],
): string {
  const memberMap = new Map(members.map((m) => [m.id, m]));
  const lines: string[] = [];
  lines.push('[家庭关系图]（你只能使用下表中的称谓称呼对方，禁止自创）');

  const out = relations.filter((r) => r.fromMemberId === selfMemberId);
  for (const r of out) {
    const to = memberMap.get(r.toMemberId);
    if (!to) continue;
    if (r.status === 'deceased') {
      lines.push(`- ${to.name}（${relationLabel(r.relationType)}，已故）：在追忆性话题中可提及，平时不主动提起`);
      continue;
    }
    if (r.status === 'estranged') {
      lines.push(`- ${to.name}（${relationLabel(r.relationType)}，关系疏远）：尽量回避不熟络的话题`);
      continue;
    }
    const co = r.coAddressTerms.length ? `，备选「${r.coAddressTerms.join('」「')}」` : '';
    lines.push(
      `- 当对方是 ${to.name}（${relationLabel(r.relationType)}）时：你称呼对方为「${r.addressTerm}」${co}`,
    );
  }

  const inEdges = relations.filter((r) => r.toMemberId === selfMemberId && r.status === 'active');
  if (inEdges.length) {
    lines.push('');
    lines.push('[反向关系]（用于理解对方称呼你时的语境）');
    for (const r of inEdges) {
      const from = memberMap.get(r.fromMemberId);
      if (!from) continue;
      lines.push(`- ${from.name} 会称呼你为「${r.addressTerm}」`);
    }
  }

  return lines.join('\n');
}
