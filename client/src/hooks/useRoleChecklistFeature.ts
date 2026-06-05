import { useAuth } from "@/contexts/AuthContext";
import { businessHasRoleChecklist } from "@shared/roleChecklistAccess";

/**
 * Whether the current tenant gets the Job Card role checklist
 * (Kaitiaki / Kaiwhangai / Kaitirotiro). Treemarkables-only — see
 * shared/roleChecklistAccess.ts.
 */
export function useRoleChecklistFeature(): boolean {
  const { currentUser } = useAuth();
  return businessHasRoleChecklist(currentUser?.businessId);
}
