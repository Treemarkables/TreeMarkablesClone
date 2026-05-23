import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { ArrowLeft, Plus, Pencil, Trash2, Shield, Users, Lock, Save, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface PermissionDef {
  key: string;
  label: string;
  description?: string;
}
interface PermissionCategory {
  id: string;
  label: string;
  description?: string;
  permissions: PermissionDef[];
}
interface RoleTier {
  id: string;
  key: string | null;
  name: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  isDefault: boolean;
  sortOrder: number;
}
interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  role: 'admin' | 'crew';
  roleTierId?: string | null;
  permissionOverrides?: { grant?: string[]; deny?: string[] } | null;
  status: string;
}

const ALL_WILDCARD = '*';

function tierGrants(tier: RoleTier, allKeys: string[]): Set<string> {
  if (tier.permissions.includes(ALL_WILDCARD)) return new Set(allKeys);
  return new Set(tier.permissions);
}

// =============================================================================
// Role Tier editor
// =============================================================================

function TierEditorDialog({
  open,
  onClose,
  tier,
  categories,
  allKeys,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  tier: RoleTier | null;
  categories: PermissionCategory[];
  allKeys: string[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const isNew = !tier;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [perms, setPerms] = useState<Set<string>>(new Set());
  const [wildcard, setWildcard] = useState(false);

  useEffect(() => {
    if (open) {
      setName(tier?.name ?? '');
      setDescription(tier?.description ?? '');
      setIsDefault(!!tier?.isDefault);
      const tierPerms = tier?.permissions ?? [];
      if (tierPerms.includes(ALL_WILDCARD)) {
        setWildcard(true);
        setPerms(new Set(allKeys));
      } else {
        setWildcard(false);
        setPerms(new Set(tierPerms));
      }
    }
  }, [open, tier, allKeys]);

  const togglePerm = (key: string, checked: boolean) => {
    const next = new Set(perms);
    if (checked) next.add(key); else next.delete(key);
    setPerms(next);
    if (wildcard) setWildcard(false);
  };

  const toggleCategory = (cat: PermissionCategory, checked: boolean) => {
    const next = new Set(perms);
    cat.permissions.forEach((p) => {
      if (checked) next.add(p.key); else next.delete(p.key);
    });
    setPerms(next);
    if (wildcard) setWildcard(false);
  };

  const toggleAll = (checked: boolean) => {
    setWildcard(checked);
    setPerms(checked ? new Set(allKeys) : new Set());
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Name is required');
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        permissions: wildcard ? [ALL_WILDCARD] : Array.from(perms),
        isDefault,
      };
      if (isNew) {
        return apiRequest('POST', '/api/role-tiers', payload);
      }
      return apiRequest('PUT', `/api/role-tiers/${tier!.id}`, payload);
    },
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err?.message || 'Failed to save tier', variant: 'destructive' });
    },
  });

  const grantedCount = wildcard ? allKeys.length : perms.size;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? 'New role tier' : `Edit ${tier?.name}`}</DialogTitle>
          <DialogDescription>
            Pick the permissions this tier grants. Staff assigned to this tier inherit all checked permissions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tier-name">Name</Label>
              <Input
                id="tier-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Office Admin"
                data-testid="input-tier-name"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center justify-between">
                <span>Default tier</span>
                <Switch checked={isDefault} onCheckedChange={setIsDefault} data-testid="switch-tier-default" />
              </Label>
              <p className="text-xs text-muted-foreground">New staff are assigned this tier when none is picked.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tier-description">Description</Label>
            <Textarea
              id="tier-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this tier is for…"
              data-testid="input-tier-description"
            />
          </div>

          <div className="flex items-center justify-between border rounded-md p-3 bg-muted/30">
            <div>
              <p className="font-medium">Grant all permissions</p>
              <p className="text-xs text-muted-foreground">Full access — recommended for Owner / Director roles.</p>
            </div>
            <Switch checked={wildcard} onCheckedChange={toggleAll} data-testid="switch-tier-all" />
          </div>

          <div className="text-sm text-muted-foreground">
            <strong>{grantedCount}</strong> of {allKeys.length} permissions granted
          </div>

          <div className="space-y-3">
            {categories.map((cat) => {
              const total = cat.permissions.length;
              const granted = cat.permissions.filter((p) => wildcard || perms.has(p.key)).length;
              const allChecked = granted === total;
              const someChecked = granted > 0 && granted < total;
              return (
                <Card key={cat.id} className="border">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{cat.label}</CardTitle>
                        {cat.description && (
                          <CardDescription className="text-xs">{cat.description}</CardDescription>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {granted}/{total}
                        </Badge>
                        <Checkbox
                          checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                          onCheckedChange={(v) => toggleCategory(cat, !!v)}
                          data-testid={`checkbox-category-${cat.id}`}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {cat.permissions.map((p) => (
                        <label
                          key={p.key}
                          className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                        >
                          <Checkbox
                            checked={wildcard || perms.has(p.key)}
                            onCheckedChange={(v) => togglePerm(p.key, !!v)}
                            data-testid={`checkbox-perm-${p.key}`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{p.label}</div>
                            <code className="text-xs text-muted-foreground">{p.key}</code>
                          </div>
                        </label>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-tier">Cancel</Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !name.trim()}
            data-testid="button-save-tier"
          >
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? 'Saving…' : 'Save tier'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Staff overrides editor
// =============================================================================

function StaffOverridesDialog({
  open,
  onClose,
  employee,
  tier,
  categories,
  allKeys,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  employee: Employee | null;
  tier: RoleTier | null;
  categories: PermissionCategory[];
  allKeys: string[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [grant, setGrant] = useState<Set<string>>(new Set());
  const [deny, setDeny] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && employee) {
      setGrant(new Set(employee.permissionOverrides?.grant ?? []));
      setDeny(new Set(employee.permissionOverrides?.deny ?? []));
    }
  }, [open, employee]);

  const tierKeys = useMemo(() => (tier ? tierGrants(tier, allKeys) : new Set<string>()), [tier, allKeys]);

  const effectiveFor = (key: string): 'allow' | 'deny' => {
    if (deny.has(key)) return 'deny';
    if (grant.has(key) || tierKeys.has(key)) return 'allow';
    return 'deny';
  };

  const setState = (key: string, state: 'allow' | 'deny') => {
    const inTier = tierKeys.has(key);
    const g = new Set(grant);
    const d = new Set(deny);
    if (state === 'allow') {
      d.delete(key);
      if (!inTier) g.add(key); else g.delete(key);
    } else {
      g.delete(key);
      if (inTier) d.add(key); else d.delete(key);
    }
    setGrant(g);
    setDeny(d);
  };

  const resetToTier = () => {
    setGrant(new Set());
    setDeny(new Set());
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!employee) return;
      return apiRequest('PATCH', `/api/employees/${employee.id}/permissions`, {
        grant: Array.from(grant),
        deny: Array.from(deny),
      });
    },
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err?.message || 'Failed to save overrides', variant: 'destructive' });
    },
  });

  if (!employee) return null;
  const hasOverrides = grant.size > 0 || deny.size > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Permissions — {employee.firstName} {employee.lastName}
          </DialogTitle>
          <DialogDescription>
            {tier ? (
              <>
                Base tier: <strong>{tier.name}</strong>. Toggle any permission to override (grant or revoke) on top of the tier.
              </>
            ) : (
              <>No tier assigned — set one in the staff list first, then come back to add overrides.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div>
              {hasOverrides ? (
                <Badge variant="outline" className="gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {grant.size} grant · {deny.size} deny
                </Badge>
              ) : (
                <span className="text-muted-foreground">No overrides — using tier permissions as-is</span>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={resetToTier} disabled={!hasOverrides}>
              Reset to tier
            </Button>
          </div>

          {categories.map((cat) => (
            <Card key={cat.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{cat.label}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-1">
                {cat.permissions.map((p) => {
                  const allowed = effectiveFor(p.key) === 'allow';
                  const overridden = grant.has(p.key) || deny.has(p.key);
                  return (
                    <div
                      key={p.key}
                      className="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-muted/50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium flex items-center gap-2">
                          {p.label}
                          {overridden && (
                            <Badge variant="secondary" className="text-xs">
                              override
                            </Badge>
                          )}
                        </div>
                        <code className="text-xs text-muted-foreground">{p.key}</code>
                      </div>
                      <Switch
                        checked={allowed}
                        onCheckedChange={(v) => setState(p.key, v ? 'allow' : 'deny')}
                        data-testid={`switch-override-${p.key}`}
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? 'Saving…' : 'Save overrides'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Main page
// =============================================================================

export default function PermissionsManagement() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { isAdmin } = useAuth();

  const { data: catalogResp } = useQuery<{ success: boolean; data: { categories: PermissionCategory[]; allKeys: string[] } }>({
    queryKey: ['/api/permissions/catalog'],
  });
  const { data: tiersResp } = useQuery<{ success: boolean; data: RoleTier[] }>({
    queryKey: ['/api/role-tiers'],
  });
  const { data: staffResp } = useQuery<{ success: boolean; data: Employee[] }>({
    queryKey: ['/api/employees'],
  });

  const categories = catalogResp?.data?.categories ?? [];
  const allKeys = catalogResp?.data?.allKeys ?? [];
  const tiers = tiersResp?.data ?? [];
  const staff = staffResp?.data ?? [];
  const tierMap = useMemo(() => new Map(tiers.map((t) => [t.id, t])), [tiers]);

  const [editingTier, setEditingTier] = useState<RoleTier | null>(null);
  const [tierDialogOpen, setTierDialogOpen] = useState(false);
  const [overridesEmployee, setOverridesEmployee] = useState<Employee | null>(null);

  const deleteTierMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/role-tiers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/role-tiers'] });
      qc.invalidateQueries({ queryKey: ['/api/employees'] });
    },
    onError: (err: any) => toast({ title: 'Error', description: err?.message || 'Failed to delete', variant: 'destructive' }),
  });

  const setEmployeeTier = useMutation({
    mutationFn: async ({ id, roleTierId }: { id: string; roleTierId: string | null }) =>
      apiRequest('PATCH', `/api/employees/${id}/role-tier`, { roleTierId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/employees'] });
    },
    onError: (err: any) => toast({ title: 'Error', description: err?.message || 'Failed to update', variant: 'destructive' }),
  });

  const onTierSaved = () => {
    qc.invalidateQueries({ queryKey: ['/api/role-tiers'] });
  };
  const onOverridesSaved = () => {
    qc.invalidateQueries({ queryKey: ['/api/employees'] });
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Lock className="w-8 h-8 mx-auto mb-3" />
            You need admin access to manage roles and permissions.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 md:p-6 pb-2">
        <Button variant="ghost" size="sm" asChild className="self-start">
          <Link href="/settings" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Settings
          </Link>
        </Button>
      </div>

      <div className="px-4 md:px-6 pb-6 space-y-4 overflow-y-auto">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Roles &amp; Permissions</h1>
            <p className="text-muted-foreground">
              Define what each staff member can do — manage role tiers and per-staff overrides.
            </p>
          </div>
        </div>

        <Tabs defaultValue="tiers" className="w-full">
          <TabsList>
            <TabsTrigger value="tiers" data-testid="tab-tiers">
              <Shield className="w-4 h-4 mr-2" /> Role tiers
            </TabsTrigger>
            <TabsTrigger value="staff" data-testid="tab-staff">
              <Users className="w-4 h-4 mr-2" /> Staff permissions
            </TabsTrigger>
          </TabsList>

          {/* ============================== TIERS ============================== */}
          <TabsContent value="tiers" className="space-y-4">
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setEditingTier(null);
                  setTierDialogOpen(true);
                }}
                data-testid="button-new-tier"
              >
                <Plus className="w-4 h-4 mr-2" /> New tier
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tiers.map((t) => {
                const granted = t.permissions.includes(ALL_WILDCARD) ? allKeys.length : t.permissions.length;
                return (
                  <Card key={t.id} className="hover:shadow-md transition-shadow" data-testid={`card-tier-${t.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
                            {t.name}
                            {t.isDefault && <Badge variant="secondary">Default</Badge>}
                            {t.isSystem && <Badge variant="outline">System</Badge>}
                          </CardTitle>
                          {t.description && (
                            <CardDescription className="mt-1">{t.description}</CardDescription>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingTier(t);
                              setTierDialogOpen(true);
                            }}
                            data-testid={`button-edit-tier-${t.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {!t.isSystem && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => {
                                if (confirm(`Delete tier "${t.name}"? Staff on this tier will fall back to the default.`)) {
                                  deleteTierMutation.mutate(t.id);
                                }
                              }}
                              data-testid={`button-delete-tier-${t.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground">
                        <strong className="text-foreground">{granted}</strong> of {allKeys.length} permissions
                      </div>
                      {t.permissions.includes(ALL_WILDCARD) && (
                        <Badge className="mt-2" variant="default">Full access</Badge>
                      )}
                      <div className="mt-3 text-xs">
                        {staff.filter((s) => s.roleTierId === t.id).length} staff assigned
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* ============================== STAFF ============================== */}
          <TabsContent value="staff" className="space-y-3">
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {staff.map((emp) => {
                    const tier = emp.roleTierId ? tierMap.get(emp.roleTierId) ?? null : null;
                    const overrides = emp.permissionOverrides ?? {};
                    const grantCount = overrides.grant?.length ?? 0;
                    const denyCount = overrides.deny?.length ?? 0;
                    const hasOverrides = grantCount + denyCount > 0;
                    return (
                      <div
                        key={emp.id}
                        className="p-4 flex items-center gap-4 flex-wrap"
                        data-testid={`row-staff-${emp.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">
                            {emp.firstName} {emp.lastName}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {emp.email || 'No email'} · legacy role: {emp.role}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground">Tier</Label>
                          <Select
                            value={emp.roleTierId ?? '__none__'}
                            onValueChange={(v) =>
                              setEmployeeTier.mutate({
                                id: emp.id,
                                roleTierId: v === '__none__' ? null : v,
                              })
                            }
                          >
                            <SelectTrigger className="w-[200px]" data-testid={`select-tier-${emp.id}`}>
                              <SelectValue placeholder="No tier" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">No tier (use default)</SelectItem>
                              {tiers.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-2">
                          {hasOverrides ? (
                            <Badge variant="outline" className="gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {grantCount}+ / {denyCount}-
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">No overrides</span>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setOverridesEmployee(emp)}
                            data-testid={`button-overrides-${emp.id}`}
                          >
                            <Pencil className="w-4 h-4 mr-2" />
                            Customise
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {staff.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                      No staff members yet. Add staff in <Link href="/settings/staff" className="underline">Staff Management</Link> first.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <TierEditorDialog
        open={tierDialogOpen}
        onClose={() => setTierDialogOpen(false)}
        tier={editingTier}
        categories={categories}
        allKeys={allKeys}
        onSaved={onTierSaved}
      />

      <StaffOverridesDialog
        open={!!overridesEmployee}
        onClose={() => setOverridesEmployee(null)}
        employee={overridesEmployee}
        tier={overridesEmployee?.roleTierId ? tierMap.get(overridesEmployee.roleTierId) ?? null : null}
        categories={categories}
        allKeys={allKeys}
        onSaved={onOverridesSaved}
      />
    </div>
  );
}
