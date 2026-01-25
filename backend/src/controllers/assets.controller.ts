import { Request, Response, NextFunction } from 'express';
import { AssetsService } from '../services/assets.service';

export const getAssets = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const assets = await AssetsService.getAssets();
    res.json(assets);
  } catch (error) {
    next(error);
  }
};

export const createAsset = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const asset = await AssetsService.createAsset(req.body);
    res.status(201).json(asset);
  } catch (error) {
    next(error);
  }
};

export const updateAsset = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const asset = await AssetsService.updateAsset(req.params.id, req.body);
    res.json(asset);
  } catch (error) {
    next(error);
  }
};

export const deleteAsset = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await AssetsService.deleteAsset(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const addAssetVersion = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const version = await AssetsService.addVersion(req.params.id, req.body);
    res.status(201).json(version);
  } catch (error) {
    next(error);
  }
};

export const updateAssetVersion = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const version = await AssetsService.updateVersion(req.params.versionId, req.body);
    res.json(version);
  } catch (error) {
    next(error);
  }
};

export const deleteAssetVersion = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await AssetsService.deleteVersion(req.params.versionId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
