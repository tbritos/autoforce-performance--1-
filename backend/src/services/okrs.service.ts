import { prisma } from '../config/database';
import { OKR } from '../types/shared.types';

export class OKRsService {
  static async getOKRs(): Promise<OKR[]> {
    const okrs = await prisma.oKR.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return okrs.map(okr => ({
      id: okr.id,
      quarter: okr.quarter as OKR['quarter'],
      objective: okr.objective,
      progress: okr.progress,
      keyResults: okr.keyResults as OKR['keyResults'],
    }));
  }

  static async saveOKR(data: OKR): Promise<OKR> {
    const okr = await prisma.oKR.upsert({
      where: {
        id: data.id,
      },
      update: {
        quarter: data.quarter,
        objective: data.objective,
        progress: data.progress,
        keyResults: data.keyResults as any,
      },
      create: {
        id: data.id,
        quarter: data.quarter,
        objective: data.objective,
        progress: data.progress,
        keyResults: data.keyResults as any,
      },
    });

    return {
      id: okr.id,
      quarter: okr.quarter as OKR['quarter'],
      objective: okr.objective,
      progress: okr.progress,
      keyResults: okr.keyResults as OKR['keyResults'],
    };
  }

  static async deleteOKR(id: string): Promise<void> {
    await prisma.oKR.delete({
      where: { id },
    });
  }
}
