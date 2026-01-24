import { Router } from 'express';
import { getTeamMembers } from '../controllers/team.controller';

const router = Router();

router.get('/', getTeamMembers);

export default router;
