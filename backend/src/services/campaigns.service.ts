import { prisma } from '../config/database';
import { Campaign } from '../../../types';

export class CampaignsService {
  static async getCampaigns(): Promise<Campaign[]> {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { startDate: 'desc' },
    });

    return campaigns.map(item => ({
      id: item.id,
      name: item.name,
      platform: item.platform as Campaign['platform'],
      status: item.status as Campaign['status'],
      budget: item.budget,
      startDate: item.startDate.toISOString().split('T')[0],
      endDate: item.endDate.toISOString().split('T')[0],
      kpi: item.kpi || undefined,
      notes: item.notes || undefined,
    }));
  }

  static async createCampaign(data: Omit<Campaign, 'id'>): Promise<Campaign> {
    const campaign = await prisma.campaign.create({
      data: {
        name: data.name,
        platform: data.platform,
        status: data.status,
        budget: data.budget,
        startDate: new Date(`${data.startDate}T00:00:00`),
        endDate: new Date(`${data.endDate}T00:00:00`),
        kpi: data.kpi || null,
        notes: data.notes || null,
      },
    });

    return {
      id: campaign.id,
      name: campaign.name,
      platform: campaign.platform as Campaign['platform'],
      status: campaign.status as Campaign['status'],
      budget: campaign.budget,
      startDate: campaign.startDate.toISOString().split('T')[0],
      endDate: campaign.endDate.toISOString().split('T')[0],
      kpi: campaign.kpi || undefined,
      notes: campaign.notes || undefined,
    };
  }

  static async updateCampaign(id: string, data: Omit<Campaign, 'id'>): Promise<Campaign> {
    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        name: data.name,
        platform: data.platform,
        status: data.status,
        budget: data.budget,
        startDate: new Date(`${data.startDate}T00:00:00`),
        endDate: new Date(`${data.endDate}T00:00:00`),
        kpi: data.kpi || null,
        notes: data.notes || null,
      },
    });

    return {
      id: campaign.id,
      name: campaign.name,
      platform: campaign.platform as Campaign['platform'],
      status: campaign.status as Campaign['status'],
      budget: campaign.budget,
      startDate: campaign.startDate.toISOString().split('T')[0],
      endDate: campaign.endDate.toISOString().split('T')[0],
      kpi: campaign.kpi || undefined,
      notes: campaign.notes || undefined,
    };
  }

  static async deleteCampaign(id: string): Promise<void> {
    await prisma.campaign.delete({ where: { id } });
  }
}
