import { prisma } from '../config/database';
import { AssetItem } from '../../../types';

export class AssetsService {
  static async getAssets(): Promise<AssetItem[]> {
    const assets = await prisma.assetItem.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        versions: { orderBy: { createdAt: 'desc' } },
      },
    });

    return assets.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category as AssetItem['category'],
      link: item.link,
      notes: item.notes || undefined,
      tags: item.tags || [],
      versions: item.versions.map(version => ({
        id: version.id,
        label: version.label,
        link: version.link,
        createdAt: version.createdAt.toISOString().split('T')[0],
      })),
    }));
  }

  static async createAsset(data: Omit<AssetItem, 'id'>): Promise<AssetItem> {
    const asset = await prisma.assetItem.create({
      data: {
        name: data.name,
        category: data.category,
        link: data.link,
        notes: data.notes || null,
        tags: data.tags || [],
        versions: data.versions && data.versions.length > 0
          ? {
              create: data.versions.map(version => ({
                label: version.label,
                link: version.link,
              })),
            }
          : undefined,
      },
      include: {
        versions: { orderBy: { createdAt: 'desc' } },
      },
    });

    return {
      id: asset.id,
      name: asset.name,
      category: asset.category as AssetItem['category'],
      link: asset.link,
      notes: asset.notes || undefined,
      tags: asset.tags || [],
      versions: asset.versions.map(version => ({
        id: version.id,
        label: version.label,
        link: version.link,
        createdAt: version.createdAt.toISOString().split('T')[0],
      })),
    };
  }

  static async updateAsset(id: string, data: Omit<AssetItem, 'id'>): Promise<AssetItem> {
    const asset = await prisma.assetItem.update({
      where: { id },
      data: {
        name: data.name,
        category: data.category,
        link: data.link,
        notes: data.notes || null,
        tags: data.tags || [],
      },
      include: {
        versions: { orderBy: { createdAt: 'desc' } },
      },
    });

    return {
      id: asset.id,
      name: asset.name,
      category: asset.category as AssetItem['category'],
      link: asset.link,
      notes: asset.notes || undefined,
      tags: asset.tags || [],
      versions: asset.versions.map(version => ({
        id: version.id,
        label: version.label,
        link: version.link,
        createdAt: version.createdAt.toISOString().split('T')[0],
      })),
    };
  }

  static async deleteAsset(id: string): Promise<void> {
    await prisma.assetItem.delete({ where: { id } });
  }

  static async addVersion(
    assetId: string,
    data: { label: string; link: string }
  ): Promise<AssetItem['versions'][number]> {
    const version = await prisma.assetVersion.create({
      data: {
        assetId,
        label: data.label,
        link: data.link,
      },
    });

    return {
      id: version.id,
      label: version.label,
      link: version.link,
      createdAt: version.createdAt.toISOString().split('T')[0],
    };
  }

  static async updateVersion(
    versionId: string,
    data: { label: string; link: string }
  ): Promise<AssetItem['versions'][number]> {
    const version = await prisma.assetVersion.update({
      where: { id: versionId },
      data: {
        label: data.label,
        link: data.link,
      },
    });

    return {
      id: version.id,
      label: version.label,
      link: version.link,
      createdAt: version.createdAt.toISOString().split('T')[0],
    };
  }

  static async deleteVersion(versionId: string): Promise<void> {
    await prisma.assetVersion.delete({ where: { id: versionId } });
  }
}
