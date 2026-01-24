import { prisma } from '../config/database';
import { AssetItem } from '../../../types';

export class AssetsService {
  static async getAssets(): Promise<AssetItem[]> {
    const assets = await prisma.assetItem.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return assets.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category as AssetItem['category'],
      link: item.link,
      notes: item.notes || undefined,
    }));
  }

  static async createAsset(data: Omit<AssetItem, 'id'>): Promise<AssetItem> {
    const asset = await prisma.assetItem.create({
      data: {
        name: data.name,
        category: data.category,
        link: data.link,
        notes: data.notes || null,
      },
    });

    return {
      id: asset.id,
      name: asset.name,
      category: asset.category as AssetItem['category'],
      link: asset.link,
      notes: asset.notes || undefined,
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
      },
    });

    return {
      id: asset.id,
      name: asset.name,
      category: asset.category as AssetItem['category'],
      link: asset.link,
      notes: asset.notes || undefined,
    };
  }

  static async deleteAsset(id: string): Promise<void> {
    await prisma.assetItem.delete({ where: { id } });
  }
}
