import { prisma } from '../config/database';
import { EmailCampaign } from '../../../types';
import { fetchRdEmails, fetchRdWorkflowEmails } from './rdstation.service';

export class EmailService {
  static async getSyncLogs(limit = 50) {
    const logs = await prisma.syncLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: limit,
    });

    return logs.map((log) => ({
      id: log.id,
      source: log.source,
      status: log.status,
      message: log.message || undefined,
      startedAt: log.startedAt.toISOString(),
      finishedAt: log.finishedAt ? log.finishedAt.toISOString() : undefined,
    }));
  }

  static async getEmailCampaigns(source: 'manual' | 'rd' = 'manual'): Promise<EmailCampaign[]> {
    const campaigns = await prisma.emailCampaign.findMany({
      where: { source },
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
        source: 'manual',
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
        source: 'manual',
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

  static async syncRdCampaigns(startDate?: string, endDate?: string): Promise<EmailCampaign[]> {
    const log = await prisma.syncLog.create({
      data: {
        source: 'rd_emails',
        status: 'running',
      },
    });

    try {
      const emails = await fetchRdEmails(startDate, endDate);

      for (const email of emails) {
        await prisma.emailCampaign.upsert({
          where: {
            externalId_source: {
              externalId: email.id,
              source: 'rd',
            },
          },
          update: {
            name: email.name,
            date: new Date(`${email.date}T00:00:00`),
            sends: email.sends,
            opens: email.opens,
            clicks: email.clicks,
            conversions: email.conversions,
            bounce: email.bounce,
          },
          create: {
            externalId: email.id,
            source: 'rd',
            name: email.name,
            date: new Date(`${email.date}T00:00:00`),
            sends: email.sends,
            opens: email.opens,
            clicks: email.clicks,
            conversions: email.conversions,
            bounce: email.bounce,
          },
        });
      }

      await prisma.syncLog.update({
        where: { id: log.id },
        data: {
          status: 'success',
          finishedAt: new Date(),
        },
      });

      return await this.getEmailCampaigns('rd');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      await prisma.syncLog.update({
        where: { id: log.id },
        data: {
          status: 'error',
          message,
          finishedAt: new Date(),
        },
      });
      throw error;
    }
  }

  static async getWorkflowStats(): Promise<any[]> {
    const stats = await prisma.workflowEmailStat.findMany({
      orderBy: { date: 'desc' },
    });

    return stats.map(item => ({
      id: item.id,
      externalId: item.externalId,
      workflowId: item.workflowId || undefined,
      workflowName: item.workflowName,
      emailName: item.emailName,
      delivered: item.delivered,
      opened: item.opened,
      clicked: item.clicked,
      bounced: item.bounced,
      unsubscribed: item.unsubscribed,
      deliveredRate: item.deliveredRate,
      openedRate: item.openedRate,
      clickedRate: item.clickedRate,
      spamRate: item.spamRate,
      date: item.date.toISOString().split('T')[0],
    }));
  }

  static async syncWorkflowStats(startDate?: string, endDate?: string): Promise<any[]> {
    const log = await prisma.syncLog.create({
      data: {
        source: 'rd_workflows',
        status: 'running',
      },
    });

    try {
      const stats = await fetchRdWorkflowEmails(startDate, endDate);

      for (const stat of stats) {
        await prisma.workflowEmailStat.upsert({
          where: {
            externalId_source: {
              externalId: stat.id,
              source: 'rd',
            },
          },
          update: {
            workflowId: stat.workflowId || null,
            workflowName: stat.workflowName,
            emailName: stat.emailName,
            delivered: stat.delivered,
            opened: stat.opened,
            clicked: stat.clicked,
            bounced: stat.bounced,
            unsubscribed: stat.unsubscribed,
            deliveredRate: stat.deliveredRate,
            openedRate: stat.openedRate,
            clickedRate: stat.clickedRate,
            spamRate: stat.spamRate,
            date: new Date(`${stat.date}T00:00:00`),
          },
          create: {
            externalId: stat.id,
            source: 'rd',
            workflowId: stat.workflowId || null,
            workflowName: stat.workflowName,
            emailName: stat.emailName,
            delivered: stat.delivered,
            opened: stat.opened,
            clicked: stat.clicked,
            bounced: stat.bounced,
            unsubscribed: stat.unsubscribed,
            deliveredRate: stat.deliveredRate,
            openedRate: stat.openedRate,
            clickedRate: stat.clickedRate,
            spamRate: stat.spamRate,
            date: new Date(`${stat.date}T00:00:00`),
          },
        });
      }

      await prisma.syncLog.update({
        where: { id: log.id },
        data: {
          status: 'success',
          finishedAt: new Date(),
        },
      });

      return await this.getWorkflowStats();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      await prisma.syncLog.update({
        where: { id: log.id },
        data: {
          status: 'error',
          message,
          finishedAt: new Date(),
        },
      });
      throw error;
    }
  }
}
