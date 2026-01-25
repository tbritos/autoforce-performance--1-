import { Router } from 'express';
import { getAssets, createAsset, updateAsset, deleteAsset, addAssetVersion, updateAssetVersion, deleteAssetVersion } from '../controllers/assets.controller';

const router = Router();

router.get('/', getAssets);
router.post('/', createAsset);
router.post('/:id/versions', addAssetVersion);
router.put('/:id/versions/:versionId', updateAssetVersion);
router.delete('/:id/versions/:versionId', deleteAssetVersion);
router.put('/:id', updateAsset);
router.delete('/:id', deleteAsset);

export default router;
