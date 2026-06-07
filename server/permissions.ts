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
import { resolveEntitlements, filterPermissionsByFeatureSet } from './tenancy/entitlements';
import { getBusinessFeatureSet } from './tierMatrix';
import type { Entitlement } from './tenancy/capabilities';

// Subscription-entitlement gating of RBAC permissions. Flag-gated OFF by default
// so existing behaviour is unchanged; enable per-environment once every business
// has its plan/add-ons provisioned (incl. Treemarkables' comped Business sub).
// See INFLOW_SAAS_PLAN.md.
const ENTITLEMENT_ENFORCEMENT = process.env.ENTITLEMENT_ENFORCEMENT === 'true';

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

  const perms = resolvePermissions({
    legacyRole: employee.role,
    tierPermissions,
    overrides: employee.permissionOverrides ?? null,
  });

  // Effective = RBAC ∩ what the business's PLAN unlocks (the tier matrix is the
  // source of truth). Gates by BUSINESS (what was paid for), so it applies even
  // to admins. No-op unless the flag is set.
  if (ENTITLEMENT_ENFORCEMENT && employee.businessId) {
    const featureSet = await getBusinessFeatureSet(employee.businessId);
    return filterPermissionsByFeatureSet(perms, featureSet);
  }
  return perms;
}

/**
 * Business-level add-on gate. Blocks a route unless the business has the required
 * entitlement (e.g. an active add-on). Use for cost-incurring features that aren't a
 * per-staff RBAC concern — primarily the AI bundle, which has no permission key.
 *
 * Flag-gated by the same ENTITLEMENT_ENFORCEMENT switch: a no-op until enforcement is
 * turned on, so landing this changes nothing until the flag flips (at which point
 * every business — incl. comped Treemarkables — must have the add-on activated).
 */
export function requireEntitlement(required: Entitlement) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!ENTITLEMENT_ENFORCEMENT) {
      next();
      return;
    }
    try {
      const businessId = req.session.businessId;
      if (!businessId) {
        res.status(403).json({ success: false, message: 'Authentication required' });
        return;
      }
      const { entitlements } = await resolveEntitlements(businessId);
      if (!entitlements.has(required)) {
        res.status(403).json({ success: false, message: `This feature needs the ${required} add-on.` });
        return;
      }
      next();
    } catch (error) {
      console.error('Error in requireEntitlement middleware:', error);
      res.status(403).json({ success: false, message: 'Entitlement check failed' });
    }
  };
}

/**
 * Capability gate driven by the tier matrix: blocks a route unless the business's
 * plan includes the given capability key (server/tenancy/capabilities.ts). Use for
 * features gated by plan rather than per-staff RBAC — e.g. SMS and AI, which are now
 * tier-bundled. Flag-gated by ENTITLEMENT_ENFORCEMENT (no-op until enforcement is on,
 * so landing this changes nothing; comped Treemarkables is on Business, which unlocks
 * everything in the matrix).
 */
export function requireCapability(capabilityKey: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!ENTITLEMENT_ENFORCEMENT) {
      next();
      return;
    }
    try {
      const businessId = req.session.businessId;
      if (!businessId) {
        res.status(403).json({ success: false, message: 'Authentication required' });
        return;
      }
      const featureSet = await getBusinessFeatureSet(businessId);
      if (!featureSet.has(capabilityKey)) {
        res.status(403).json({ success: false, message: "Your plan doesn't include this feature." });
        return;
      }
      next();
    } catch (error) {
      console.error('Error in requireCapability middleware:', error);
      res.status(403).json({ success: false, message: 'Capability check failed' });
    }
  };
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
