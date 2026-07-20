import type { AuthUser } from '../auth.service';

export interface ReportOwnershipFields {
  createdBy: string | null;
  isPublic: boolean;
}

// Relatório sem dono (criado antes desse recurso existir, ou nunca "adotado")
// não trava ninguém — tratado como se fosse de todo mundo.
export function isReportOwner(report: { createdBy: string | null }, user?: AuthUser): boolean {
  if (!report.createdBy) return true;
  if (!user?.email) return false;
  return report.createdBy.trim().toLowerCase() === user.email.trim().toLowerCase();
}

// 'admin' hoje só é setado pelo bypass de sistema/API key (auth.middleware.ts) —
// nenhuma conta humana real tem essa role ainda, então esse override é inerte
// na prática até isso mudar.
export function isReportAdmin(user?: AuthUser): boolean {
  return user?.role === 'admin';
}

export function canViewReport(report: ReportOwnershipFields, user?: AuthUser): boolean {
  return report.isPublic || isReportOwner(report, user) || isReportAdmin(user);
}

export function canEditReport(report: { createdBy: string | null }, user?: AuthUser): boolean {
  return isReportOwner(report, user) || isReportAdmin(user);
}
