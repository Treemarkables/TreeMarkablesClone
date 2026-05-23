// ============================================================================
// Backend permission resolution + middleware.
//
// Permission keys are defined in shared/permissions.ts. This file resolves an
// employee's effective permission set (tier + per-staff overrides + legacy
// admin/crew fallback) and exposes a `requirePermission(key)` middleware
// equivalent to the existing `requireAdmin`.
// ============================================================================
import type { Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import {
  resolvePermissions,
  DEFAULT_TIER_SEEDS,
  ALL_PERMISSION_KEYS,
  isValidPermissionKey,
} from '@shared/permissions';
import type { Employee, RoleTier } from '@shared/schema';

export async function getEmployeePermissions(employee: Employee): Promise<Set<string>> {
  let tierPermissions: string[] | null = null;

  if (employee.roleTierId) {
    const tier = await storage.getRoleTier(employee.roleTierId);
    if (tier) {
      tierPermissions = (tier.permissions ?? []) as string[];
    }
  }

  // If no explicit tier and the employee isn't an admin, fall back to the system default tier
  if (tierPermissions === null && employee.role !== 'admin') {
    const def = await storage.getDefaultRoleTier();
    if (def) tierPermissions = (def.permissions ?? []) as string[];
  }

  return resolvePermissions({
    legacyRole: employee.role,
    tierPermissions,
    overrides: employee.permissionOverrides ?? null,
  });
}

export function requirePermission(key: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const employeeId = req.session.employeeId;
      if (!employeeId) {
        res.status(403).json({ success: false, message: 'Authentication required' });
        return;
      }
      const employee = await storage.getEmployee(employeeId);
      if (!employee) {
        res.status(403).json({ success: false, message: 'Employee not found' });
        return;
      }
      const perms = await getEmployeePermissions(employee);
      if (!perms.has(key)) {
        res.status(403).json({
          success: false,
          message: `Permission required: ${key}`,
        });
        return;
      }
      next();
    } catch (error) {
      console.error('Error in requirePermission middleware:', error);
      res.status(403).json({ success: false, message: 'Permission check failed' });
    }
  };
}

// Seed system tiers on boot. Idempotent — upserts by `key`.
let seedPromise: Promise<void> | null = null;
export function ensureRoleTiersSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      try {
        const existing = await storage.getAllRoleTiers();
        const byKey = new Map(existing.filter((t) => t.key).map((t) => [t.key as string, t]));
        let sortOrder = 0;
        for (const seed of DEFAULT_TIER_SEEDS) {
          const found = byKey.get(seed.key);
          if (!found) {
            await storage.createRoleTier({
              key: seed.key,
              name: seed.name,
              description: seed.description,
              permissions: seed.permissions,
              isSystem: seed.isSystem,
              isDefault: !!seed.isDefault,
              sortOrder,
            } as any);
          }
          sortOrder += 10;
        }
        // Make sure exactly one tier is the default — pick the seeded default if none set
        const all = await storage.getAllRoleTiers();
        const hasDefault = all.some((t) => t.isDefault);
        if (!hasDefault) {
          const fallback = all.find((t) => t.key === 'crew') ?? all[0];
          if (fallback) {
            await storage.updateRoleTier(fallback.id, { isDefault: true });
          }
        }
      } catch (err) {
        console.error('[permissions] Failed to seed role tiers:', err);
        // Reset so a later call can retry
        seedPromise = null;
        throw err;
      }
    })();
  }
  return seedPromise;
}

export function validatePermissionKeys(keys: string[]): { ok: true } | { ok: false; bad: string[] } {
  const bad = keys.filter((k) => k !== '*' && !isValidPermissionKey(k));
  return bad.length === 0 ? { ok: true } : { ok: false, bad };
}

export { ALL_PERMISSION_KEYS };
