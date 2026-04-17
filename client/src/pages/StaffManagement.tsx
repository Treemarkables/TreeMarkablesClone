import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Users,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Phone,
  Mail,
  Calendar,
  Award,
  DollarSign,
  Clock,
  UserCheck,
  UserX,
  Settings,
  ChevronLeft,
  Lock,
} from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";

// Staff role options
const STAFF_ROLES = [
  {
    value: "admin",
    label: "Admin",
    color: "bg-gradient-to-r from-purple-500 to-pink-500",
  },
  {
    value: "crew",
    label: "Crew",
    color: "bg-gradient-to-r from-green-500 to-emerald-500",
  },
];

const POSITIONS = [
  "Arborist",
  "Ground Crew",
  "Foreman",
  "Driver",
  "Climber",
  "Equipment Operator",
  "Safety Officer",
  "Apprentice",
];

const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert"];

const COMMON_CERTIFICATIONS = [
  "ISA Certified Arborist",
  "CTSP (Tree Safety Professional)",
  "Chainsaw Operation",
  "Aerial Lift Operation",
  "First Aid & CPR",
  "Crane Operation",
  "OSHA 10",
  "Commercial Driver License",
];

const NZ_LICENCES = [
  "EWP Ticket (Elevated Work Platform)",
  "Class 2 Heavy Motor Vehicle Licence",
  "Class 4 Heavy Motor Vehicle Licence",
  "Class 5 Heavy Motor Vehicle Licence",
  "Chainsaw Unit Standard (US6377)",
  "Competent Person Certificate (Arboriculture)",
  "NZQA Level 4 Arboriculture",
  "Crane Licence (Dogman / Rigger)",
  "Forklift Licence",
  "First Aid Certificate",
];

const COMMON_SKILLS = [
  "Tree Climbing",
  "Chainsaw Operation",
  "Bucket Truck Operation",
  "Stump Grinding",
  "Tree Identification",
  "Rigging & Removal",
  "Pruning Techniques",
  "Emergency Response",
  "Customer Service",
  "Equipment Maintenance",
];

// Form schema for staff
const staffFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().optional(),
  position: z.string().min(1, "Position is required"),
  role: z.enum(["admin", "crew"]),
  status: z.enum(["active", "inactive", "on_leave"]).default("active"),
  skillLevel: z
    .enum(["beginner", "intermediate", "advanced", "expert"])
    .default("beginner"),
  hourlyRate: z.string().optional(),
  chargeOutRate: z.string().optional(),
  costLineItemNumber: z.string().optional(),
  chargeOutLineItemNumber: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  notes: z.string().optional(),
  hireDate: z.string().optional(),
  certifications: z.array(z.string()).default([]),
  licences: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
});

type StaffFormData = z.infer<typeof staffFormSchema>;

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  position: string;
  role: "admin" | "crew";
  status: "active" | "inactive" | "on_leave";
  skillLevel: "beginner" | "intermediate" | "advanced" | "expert";
  hourlyRate?: string;
  chargeOutRate?: string;
  costLineItemNumber?: string;
  chargeOutLineItemNumber?: string;
  certifications: string[];
  licences: string[];
  skills: string[];
  emergencyContact?: string;
  emergencyContactPhone?: string;
  notes?: string;
  hireDate?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function StaffFormDialog({
  staff,
  isOpen,
  onClose,
  onSubmit,
}: {
  staff?: StaffMember;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: StaffFormData) => void;
}) {
  const { data: materialsData } = useQuery({
    queryKey: ["/api/materials-services"],
    enabled: isOpen,
  });
  const labourItems = ((materialsData as any)?.data || []).filter(
    (item: any) => item.category === "Labour"
  );

  const form = useForm<StaffFormData>({
    resolver: zodResolver(staffFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      position: "",
      role: "crew",
      status: "active",
      skillLevel: "beginner",
      hourlyRate: "",
      chargeOutRate: "",
      costLineItemNumber: "",
      chargeOutLineItemNumber: "",
      emergencyContact: "",
      emergencyContactPhone: "",
      notes: "",
      hireDate: "",
      certifications: [],
      skills: [],
      licences: [],
    },
  });

  // Reset form when staff data changes or dialog opens
  React.useEffect(() => {
    if (isOpen) {
      if (staff) {
        form.reset({
          firstName: staff.firstName,
          lastName: staff.lastName,
          email: staff.email || "",
          phone: staff.phone || "",
          position: staff.position,
          role: staff.role,
          status: staff.status,
          skillLevel: staff.skillLevel,
          hourlyRate: staff.hourlyRate || "",
          chargeOutRate: staff.chargeOutRate || "",
          costLineItemNumber: (staff as any).costLineItemNumber || "",
          chargeOutLineItemNumber: (staff as any).chargeOutLineItemNumber || "",
          emergencyContact: staff.emergencyContact || "",
          emergencyContactPhone: staff.emergencyContactPhone || "",
          notes: staff.notes || "",
          hireDate: staff.hireDate || "",
          certifications: staff.certifications || [],
          licences: staff.licences || [],
          skills: staff.skills || [],
        });
      } else {
        form.reset({
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          position: "",
          role: "crew",
          status: "active",
          skillLevel: "beginner",
          hourlyRate: "",
          chargeOutRate: "",
          costLineItemNumber: "",
          chargeOutLineItemNumber: "",
          emergencyContact: "",
          emergencyContactPhone: "",
          notes: "",
          hireDate: "",
          certifications: [],
          licences: [],
          skills: [],
        });
      }
    }
  }, [staff, isOpen, form]);

  const handleSubmit = (data: StaffFormData) => {
    onSubmit(data);
    form.reset();
  };

  const addCertification = (cert: string) => {
    const current = form.getValues("certifications");
    if (!current.includes(cert)) {
      form.setValue("certifications", [...current, cert]);
    }
  };

  const removeCertification = (cert: string) => {
    const current = form.getValues("certifications");
    form.setValue(
      "certifications",
      current.filter((c) => c !== cert),
    );
  };

  const addLicence = (lic: string) => {
    const current = form.getValues("licences");
    if (!current.includes(lic)) {
      form.setValue("licences", [...current, lic]);
    }
  };

  const removeLicence = (lic: string) => {
    const current = form.getValues("licences");
    form.setValue("licences", current.filter((l) => l !== lic));
  };

  const addSkill = (skill: string) => {
    const current = form.getValues("skills");
    if (!current.includes(skill)) {
      form.setValue("skills", [...current, skill]);
    }
  };

  const removeSkill = (skill: string) => {
    const current = form.getValues("skills");
    form.setValue(
      "skills",
      current.filter((s) => s !== skill),
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-4 rounded-t-lg -m-6 mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            <DialogTitle className="text-white">
              {staff ? "Edit Staff Member" : "Add New Staff Member"}
            </DialogTitle>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            {/* Basic Information */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name *</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-first-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name *</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-last-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        {...field}
                        data-testid="input-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Role and Position */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-role">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {STAFF_ROLES.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Position *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-position">
                          <SelectValue placeholder="Select position" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {POSITIONS.map((position) => (
                          <SelectItem
                            key={position}
                            value={position.toLowerCase().replace(/\s+/g, "_")}
                          >
                            {position}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="skillLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Skill Level</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-skill-level">
                          <SelectValue placeholder="Select skill level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SKILL_LEVELS.map((level) => (
                          <SelectItem key={level} value={level.toLowerCase()}>
                            {level}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Status and Rates */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="on_leave">On Leave</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hourlyRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost Rate (NZD/hr)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Internal cost rate"
                        {...field}
                        data-testid="input-hourly-rate"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="chargeOutRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Charge-out Rate (NZD/hr)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Customer billing rate"
                        {...field}
                        data-testid="input-charge-out-rate"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hireDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hire Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        data-testid="input-hire-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Line Item Assignments */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="costLineItemNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost Line Item</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-cost-line-item">
                          <SelectValue placeholder="Select cost item..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {labourItems.map((item: any) => (
                          <SelectItem key={item.itemNumber} value={item.itemNumber}>
                            {item.itemNumber} — {item.name} (${parseFloat(item.price).toFixed(2)}/hr)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="chargeOutLineItemNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Charge-out Line Item</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-charge-out-line-item">
                          <SelectValue placeholder="Select charge-out item..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {labourItems.map((item: any) => (
                          <SelectItem key={item.itemNumber} value={item.itemNumber}>
                            {item.itemNumber} — {item.name} (${parseFloat(item.price).toFixed(2)}/hr)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Emergency Contact */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="emergencyContact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emergency Contact Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-emergency-contact" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="emergencyContactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emergency Contact Phone</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-emergency-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Certifications */}
            <div className="space-y-2">
              <FormLabel>Certifications</FormLabel>
              <div className="flex flex-wrap gap-2 mb-2">
                {form.watch("certifications").map((cert) => (
                  <Badge
                    key={cert}
                    variant="secondary"
                    className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => removeCertification(cert)}
                    data-testid={`badge-cert-${cert.replace(/\s+/g, "-").toLowerCase()}`}
                  >
                    {cert} ×
                  </Badge>
                ))}
              </div>
              <Select onValueChange={addCertification}>
                <SelectTrigger data-testid="select-certifications">
                  <SelectValue placeholder="Add certification..." />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_CERTIFICATIONS.filter(
                    (cert) => !form.watch("certifications").includes(cert),
                  ).map((cert) => (
                    <SelectItem key={cert} value={cert}>
                      {cert}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Licences & Tickets */}
            <div className="space-y-2">
              <FormLabel>Licences &amp; Tickets</FormLabel>
              <div className="flex flex-wrap gap-2 mb-2">
                {(form.watch("licences") ?? []).map((lic) => (
                  <Badge
                    key={lic}
                    className="cursor-pointer bg-amber-100 text-amber-800 border border-amber-300 hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => removeLicence(lic)}
                    data-testid={`badge-licence-${lic.replace(/\s+/g, "-").toLowerCase()}`}
                  >
                    {lic} ×
                  </Badge>
                ))}
              </div>
              <Select onValueChange={addLicence}>
                <SelectTrigger data-testid="select-licences">
                  <SelectValue placeholder="Add licence or ticket..." />
                </SelectTrigger>
                <SelectContent>
                  {NZ_LICENCES.filter(
                    (lic) => !(form.watch("licences") ?? []).includes(lic),
                  ).map((lic) => (
                    <SelectItem key={lic} value={lic}>
                      {lic}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Skills */}
            <div className="space-y-2">
              <FormLabel>Skills</FormLabel>
              <div className="flex flex-wrap gap-2 mb-2">
                {form.watch("skills").map((skill) => (
                  <Badge
                    key={skill}
                    variant="outline"
                    className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => removeSkill(skill)}
                    data-testid={`badge-skill-${skill.replace(/\s+/g, "-").toLowerCase()}`}
                  >
                    {skill} ×
                  </Badge>
                ))}
              </div>
              <Select onValueChange={addSkill}>
                <SelectTrigger data-testid="select-skills">
                  <SelectValue placeholder="Add skill..." />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_SKILLS.filter(
                    (skill) => !form.watch("skills").includes(skill),
                  ).map((skill) => (
                    <SelectItem key={skill} value={skill}>
                      {skill}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Additional notes about this staff member..."
                      data-testid="textarea-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit Button */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                data-testid="button-save-staff"
              >
                {staff ? "Update Staff Member" : "Add Staff Member"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function SetPasswordDialog({
  staff,
  isOpen,
  onClose,
  onSubmit,
}: {
  staff: StaffMember | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (staffId: string, password: string) => void;
}) {
  const passwordSchema = z
    .object({
      password: z.string().min(8, "Password must be at least 8 characters"),
      confirmPassword: z
        .string()
        .min(8, "Password must be at least 8 characters"),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    });

  type PasswordFormData = z.infer<typeof passwordSchema>;

  const form = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const handleSubmit = (data: PasswordFormData) => {
    if (staff) {
      onSubmit(staff.id, data.password);
      form.reset();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader className="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-4 rounded-t-lg -m-6 mb-4">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            <DialogTitle className="text-white">
              Set Password for {staff?.firstName} {staff?.lastName}
            </DialogTitle>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password *</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      {...field}
                      placeholder="Enter new password (min 8 characters)"
                      data-testid="input-password"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password *</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      {...field}
                      placeholder="Confirm new password"
                      data-testid="input-confirm-password"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                data-testid="button-cancel-password"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                data-testid="button-save-password"
              >
                Set Password
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function StaffCard({
  staff,
  onEdit,
  onDelete,
  onSetPassword,
  isAdmin,
}: {
  staff: StaffMember;
  onEdit: (staff: StaffMember) => void;
  onDelete: (staff: StaffMember) => void;
  onSetPassword: (staff: StaffMember) => void;
  isAdmin: boolean;
}) {
  const roleConfig = STAFF_ROLES.find((r) => r.value === staff.role);
  const initials = `${staff.firstName[0]}${staff.lastName[0]}`.toUpperCase();

  return (
    <Card
      className="hover:shadow-md transition-shadow"
      data-testid={`card-staff-${staff.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback
                className={`text-white ${roleConfig?.color || "bg-gray-500"}`}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3
                className="font-semibold text-lg"
                data-testid={`text-staff-name-${staff.id}`}
              >
                {staff.firstName} {staff.lastName}
              </h3>
              <p className="text-sm text-muted-foreground capitalize">
                {staff.position.replace(/_/g, " ")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              className={`text-white ${roleConfig?.color || "bg-gray-500"}`}
              data-testid={`badge-role-${staff.id}`}
            >
              {roleConfig?.label || staff.role}
            </Badge>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSetPassword(staff)}
                data-testid={`button-set-password-${staff.id}`}
                title="Set Password"
              >
                <Lock className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(staff)}
                data-testid={`button-edit-${staff.id}`}
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(staff)}
                className="text-destructive hover:text-destructive"
                data-testid={`button-delete-${staff.id}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          {staff.email && (
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="truncate">{staff.email}</span>
            </div>
          )}
          {staff.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span>{staff.phone}</span>
            </div>
          )}
          {(staff.hourlyRate || staff.chargeOutRate) && (
            <div className="flex items-center gap-2 flex-wrap">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              {staff.hourlyRate && (
                <span className="text-sm">Cost: ${staff.hourlyRate}/hr</span>
              )}
              {staff.chargeOutRate && (
                <span className="text-sm text-primary">
                  Charge: ${staff.chargeOutRate}/hr
                </span>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-muted-foreground" />
            <span className="capitalize">{staff.skillLevel}</span>
          </div>
        </div>

        {staff.certifications.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-muted-foreground mb-1">
              Certifications:
            </p>
            <div className="flex flex-wrap gap-1">
              {staff.certifications.slice(0, 3).map((cert) => (
                <Badge key={cert} variant="outline" className="text-xs">
                  {cert}
                </Badge>
              ))}
              {staff.certifications.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{staff.certifications.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {staff.status === "active" ? (
              <UserCheck className="w-4 h-4 text-green-500" />
            ) : (
              <UserX className="w-4 h-4 text-red-500" />
            )}
            <span className="text-sm capitalize text-muted-foreground">
              {(staff.status || "active").replace("_", " ")}
            </span>
          </div>

          {staff.hireDate && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              <span>Hired {new Date(staff.hireDate).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function StaffManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [passwordStaff, setPasswordStaff] = useState<StaffMember | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();

  // Fetch staff data
  const { data: staffData, isLoading } = useQuery<{
    success: boolean;
    data: StaffMember[];
  }>({
    queryKey: ["/api/employees"],
  });

  const staff = staffData?.data || [];

  // Filter and sort staff based on search and filters
  const filteredStaff = staff
    .filter((member) => {
      const matchesSearch =
        member.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.position.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRole = roleFilter === "all" || member.role === roleFilter;
      const matchesStatus =
        statusFilter === "all" || member.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    })
    .sort((a, b) => {
      // Sort by creation date descending (newest first)
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

  // Create staff mutation
  const createStaffMutation = useMutation({
    mutationFn: async (data: StaffFormData) => {
      return apiRequest("POST", "/api/employees", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setIsAddDialogOpen(false);

      // Clear filters to ensure the new staff member is visible
      setSearchTerm("");
      setRoleFilter("all");
      setStatusFilter("all");

      // Scroll to top to show the new staff member (sorted newest first)
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 100);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add staff member",
        variant: "destructive",
      });
    },
  });

  // Update staff mutation
  const updateStaffMutation = useMutation({
    mutationFn: async (data: StaffFormData & { id: string }) => {
      const { id, ...updateData } = data;
      return apiRequest("PUT", `/api/employees/${id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setEditingStaff(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update staff member",
        variant: "destructive",
      });
    },
  });

  // Delete staff mutation
  const deleteStaffMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/employees/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete staff member",
        variant: "destructive",
      });
    },
  });

  // Set password mutation
  const setPasswordMutation = useMutation({
    mutationFn: async ({
      staffId,
      password,
    }: {
      staffId: string;
      password: string;
    }) => {
      return apiRequest("PATCH", `/api/employees/${staffId}/password`, {
        password,
      });
    },
    onSuccess: () => {
      setPasswordStaff(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to set password",
        variant: "destructive",
      });
    },
  });

  const handleAddStaff = (data: StaffFormData) => {
    createStaffMutation.mutate(data);
  };

  const handleEditStaff = (data: StaffFormData) => {
    if (editingStaff) {
      const apiData = {
        ...data,
        id: editingStaff.id,
      };
      updateStaffMutation.mutate(apiData);
    }
  };

  const handleDeleteStaff = (staff: StaffMember) => {
    if (
      confirm(
        `Are you sure you want to delete ${staff.firstName} ${staff.lastName}?`,
      )
    ) {
      deleteStaffMutation.mutate(staff.id);
    }
  };

  const handleSetPassword = (staffId: string, password: string) => {
    setPasswordMutation.mutate({ staffId, password });
  };

  // Calculate stats
  const totalStaff = staff.length;
  const activeStaff = staff.filter((s) => s.status === "active").length;
  const roleStats = STAFF_ROLES.map((role) => ({
    ...role,
    count: staff.filter((s) => s.role === role.value).length,
  }));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/settings">
                <Button
                  variant="ghost"
                  size="sm"
                  data-testid="button-back-to-settings"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />
              <div className="flex items-center gap-2">
                <Users className="w-6 h-6 text-orange-500" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Staff Management
                </h1>
              </div>
            </div>

            <Button
              onClick={() => setIsAddDialogOpen(true)}
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
              data-testid="button-add-staff"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Staff Member
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Total Staff
                  </p>
                  <p
                    className="text-3xl font-bold text-gray-900 dark:text-white"
                    data-testid="stat-total-staff"
                  >
                    {totalStaff}
                  </p>
                </div>
                <Users className="w-8 h-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Active Staff
                  </p>
                  <p
                    className="text-3xl font-bold text-green-600 dark:text-green-400"
                    data-testid="stat-active-staff"
                  >
                    {activeStaff}
                  </p>
                </div>
                <UserCheck className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          {roleStats.map((role) => (
            <Card key={role.value}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      {role.label}
                    </p>
                    <p
                      className={`text-3xl font-bold`}
                      data-testid={`stat-${role.value}`}
                    >
                      {role.count}
                    </p>
                  </div>
                  <div
                    className={`w-8 h-8 rounded-full ${role.color} flex items-center justify-center`}
                  >
                    <span className="text-white font-bold text-sm">
                      {role.count}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search staff by name, email, or position..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-staff"
                  />
                </div>
              </div>

              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger
                  className="w-full md:w-[180px]"
                  data-testid="select-filter-role"
                >
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {STAFF_ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger
                  className="w-full md:w-[180px]"
                  data-testid="select-filter-status"
                >
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Staff Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading staff...</p>
            </div>
          </div>
        ) : filteredStaff.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStaff.map((staffMember) => (
              <StaffCard
                key={staffMember.id}
                staff={staffMember}
                onEdit={setEditingStaff}
                onDelete={handleDeleteStaff}
                onSetPassword={setPasswordStaff}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No staff members found
              </h3>
              <p className="text-gray-500 mb-4">
                {searchTerm || roleFilter !== "all" || statusFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Get started by adding your first staff member"}
              </p>
              {!searchTerm &&
                roleFilter === "all" &&
                statusFilter === "all" && (
                  <Button
                    onClick={() => setIsAddDialogOpen(true)}
                    className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                    data-testid="button-add-first-staff"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Staff Member
                  </Button>
                )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Staff Dialog */}
      <StaffFormDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onSubmit={handleAddStaff}
      />

      {/* Edit Staff Dialog */}
      <StaffFormDialog
        staff={editingStaff || undefined}
        isOpen={!!editingStaff}
        onClose={() => setEditingStaff(null)}
        onSubmit={handleEditStaff}
      />

      {/* Set Password Dialog */}
      <SetPasswordDialog
        staff={passwordStaff}
        isOpen={!!passwordStaff}
        onClose={() => setPasswordStaff(null)}
        onSubmit={handleSetPassword}
      />
    </div>
  );
}
