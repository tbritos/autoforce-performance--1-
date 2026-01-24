import { prisma } from '../config/database';
import { TeamMember } from '../../../types';

export class TeamService {
  static async getTeamMembers(): Promise<TeamMember[]> {
    const members = await prisma.teamMember.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return members.map(member => ({
      id: member.id,
      name: member.name,
      role: member.role,
      avatar: member.avatar || '',
      status: member.status as TeamMember['status'],
      lastActive: member.lastActive,
      leadsGenerated: member.leadsGenerated,
      salesClosed: member.salesClosed,
      goalProgress: member.goalProgress,
    }));
  }
}
