import { prisma } from '../config/database';

export const UTMDestinationsService = {

  async list(createdBy: string) {
    return prisma.uTMDestination.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, label: true, url: true, createdAt: true },
    });
  },

  async create(data: { label: string; url: string; createdBy: string }) {
    return prisma.uTMDestination.create({
      data: {
        label:     data.label.trim(),
        url:       data.url.trim(),
        createdBy: data.createdBy,
      },
      select: { id: true, label: true, url: true, createdAt: true },
    });
  },

  async delete(id: string) {
    await prisma.uTMDestination.delete({ where: { id } });
  },
};
