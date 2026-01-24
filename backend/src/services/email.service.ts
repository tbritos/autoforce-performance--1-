import { prisma } from '../config/database';
import { EmailCampaign } from '../../../types';

export class EmailService {
  static async getEmailCampaigns(): Promise<EmailCampaign[]> {
    const campaigns = await prisma.emailCampaign.findMany({
      orderBy: { date: 'desc' },
    });

    return campaigns.map(item => ({
      id: item.id,
      name: item.name,
      date: item.date.toISOString().split('T')[0],
      sends: item.sends,
      opens: item.opens,
      clicks: item.clicks,
      conversions: item.conversions,
      bounce: item.bounce,
    }));
  }

  static async createEmailCampaign(data: Omit<EmailCampaign, 'id'>): Promise<EmailCampaign> {
    const campaign = await prisma.emailCampaign.create({
      data: {
        name: data.name,
        date: new Date(`${data.date}T00:00:00`),
        sends: data.sends,
        opens: data.opens,
        clicks: data.clicks,
        conversions: data.conversions,
        bounce: data.bounce,
      },
    });

    return {
      id: campaign.id,
      name: campaign.name,
      date: campaign.date.toISOString().split('T')[0],
      sends: campaign.sends,
      opens: campaign.opens,
      clicks: campaign.clicks,
      conversions: campaign.conversions,
      bounce: campaign.bounce,
    };
  }

  static async updateEmailCampaign(id: string, data: Omit<EmailCampaign, 'id'>): Promise<EmailCampaign> {
    const campaign = await prisma.emailCampaign.update({
      where: { id },
      data: {
        name: data.name,
        date: new Date(`${data.date}T00:00:00`),
        sends: data.sends,
        opens: data.opens,
        clicks: data.clicks,
        conversions: data.conversions,
        bounce: data.bounce,
      },
    });

    return {
      id: campaign.id,
      name: campaign.name,
      date: campaign.date.toISOString().split('T')[0],
      sends: campaign.sends,
      opens: campaign.opens,
      clicks: campaign.clicks,
      conversions: campaign.conversions,
      bounce: campaign.bounce,
    };
  }

  static async deleteEmailCampaign(id: string): Promise<void> {
    await prisma.emailCampaign.delete({ where: { id } });
  }
}
