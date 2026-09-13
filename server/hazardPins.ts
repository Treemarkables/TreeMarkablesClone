/**
 * Hazard-tree pin register — feature flag + request helpers.
 * APIs stay dark unless HAZARD_TREE_PINS=true. See HAZARD_TREE_PINS_PLAN.md.
 */
import type { Request, Response, NextFunction } from "express";

export const HAZARD_TREE_PINS_ENABLED =
  process.env.HAZARD_TREE_PINS === "true";

export function requireHazardTreePins(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!HAZARD_TREE_PINS_ENABLED) {
    res.status(404).json({
      success: false,
      wip: true,
      message: "Hazard tree pins are not enabled",
    });
    return;
  }
  next();
}
