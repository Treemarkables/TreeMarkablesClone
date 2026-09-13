/**
 * Client-side re-export of the shared crew-role vocabulary, so components can
 * import it via the "@/lib" alias without reaching across to "@shared".
 * The definitions live in shared/crewRoles.ts — the server names the roles in its
 * clock-in notifications and must agree with what the chips say.
 */
export { ROLE_KEYS, ROLE_LABEL, isRoleKey, type RoleKey } from "@shared/crewRoles";
