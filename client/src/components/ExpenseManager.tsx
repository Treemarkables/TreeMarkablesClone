import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Package, Wrench, Car, FileText, Edit2, Trash2, Save, X } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Expense categories
const expenseCategories = [
  { value: "materials", label: "Materials & Supplies", icon: Package, color: "bg-blue-50 text-blue-600" },
  { value: "equipment", label: "Equipment Rental", icon: Wrench, color: "bg-green-50 text-green-600" },
  { value: "travel", label: "Travel & Fuel", icon: Car, color: "bg-orange-50 text-orange-600" },
  { value: "permits", label: "Permits & Fees", icon: FileText, color: "bg-purple-50 text-purple-600" },
  { value: "other", label: "Other Costs", icon: Package, color: "bg-gray-50 text-gray-600" }
];

// Expense entry schema
const expenseEntrySchema = z.object({
  category: z.string().min(1, "Please select a category"),
  description: z.string().min(1, "Description is required"),
  amount: z.string().min(1, "Amount is required"),
  quantity: z.string().optional(),
  unitCost: z.string().optional(),
  vendor: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
});

type ExpenseEntryFormData = z.infer<typeof expenseEntrySchema>;

interface ExpenseEntry {
  id?: string;
  category: string;
  description: string;
  amount: number;
  quantity?: number;
  unitCost?: number;
  vendor?: string;
  date: string;
  notes?: string;
}

interface ExpenseManagerProps {
  jobId: string;
  compact?: boolean;
}

export function ExpenseManager({ jobId, compact = false }: ExpenseManagerProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseEntry | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch job expenses
  const { data: expensesData, isLoading } = useQuery({
    queryKey: ['/api/jobs', jobId, 'expenses'],
    enabled: !!jobId,
  });

  const expenses = (expensesData as any)?.data || [];

  // Form for adding/editing expenses
  const form = useForm<ExpenseEntryFormData>({
    resolver: zodResolver(expenseEntrySchema),
    defaultValues: {
      category: "",
      description: "",
      amount: "",
      quantity: "1",
      unitCost: "",
      vendor: "",
      date: new Date().toISOString().split('T')[0],
      notes: "",
    },
  });

  // Reset form when editing expense changes
  useEffect(() => {
    if (editingExpense) {
      form.reset({
        category: editingExpense.category,
        description: editingExpense.description,
        amount: editingExpense.amount?.toString() || '',
        quantity: editingExpense.quantity?.toString() || "1",
        unitCost: editingExpense.unitCost?.toString() || "",
        vendor: editingExpense.vendor || "",
        date: editingExpense.date,
        notes: editingExpense.notes || "",
      });
      setSelectedCategory(editingExpense.category);
    } else {
      form.reset({
        category: "",
        description: "",
        amount: "",
        quantity: "1",
        unitCost: "",
        vendor: "",
        date: new Date().toISOString().split('T')[0],
        notes: "",
      });
      setSelectedCategory("");
    }
  }, [editingExpense, form]);

  // Auto-calculate amount when quantity or unit cost changes
  const watchQuantity = form.watch("quantity");
  const watchUnitCost = form.watch("unitCost");

  useEffect(() => {
    if (watchQuantity && watchUnitCost) {
      const calculatedAmount = parseFloat(watchQuantity.toString()) * parseFloat(watchUnitCost.toString());
      if (!isNaN(calculatedAmount)) {
        form.setValue("amount", calculatedAmount.toString());
      }
    }
  }, [watchQuantity, watchUnitCost, form]);

  // Add expense mutation
  const addExpenseMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', `/api/jobs/${jobId}/expenses`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'expenses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      setIsAddDialogOpen(false);
      setEditingExpense(null);
      form.reset();
      toast({
        title: "Success",
        description: "Expense added successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add expense",
        variant: "destructive"
      });
    }
  });

  // Remove expense mutation
  const removeExpenseMutation = useMutation({
    mutationFn: async (expenseIndex: number) => {
      return await apiRequest('DELETE', `/api/jobs/${jobId}/expenses/${expenseIndex}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'expenses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: "Success",
        description: "Expense removed successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove expense",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (data: ExpenseEntryFormData) => {
    const expenseData = {
      ...data,
      amount: parseFloat(data.amount),
      quantity: data.quantity ? parseFloat(data.quantity) : 1,
      unitCost: data.unitCost ? parseFloat(data.unitCost) : undefined,
    };
    addExpenseMutation.mutate(expenseData);
  };

  const handleRemoveExpense = (index: number) => {
    removeExpenseMutation.mutate(index);
  };

  const getTotalExpenses = () => {
    return expenses.reduce((sum: number, expense: any) => sum + expense.amount, 0);
  };

  const getExpensesByCategory = () => {
    const grouped = expenses.reduce((acc: any, expense: any) => {
      if (!acc[expense.category]) {
        acc[expense.category] = { total: 0, count: 0 };
      }
      acc[expense.category].total += expense.amount;
      acc[expense.category].count += 1;
      return acc;
    }, {});
    return grouped;
  };

  const getCategoryInfo = (category: string) => {
    return expenseCategories.find(cat => cat.value === category) || expenseCategories[4]; // Default to "other"
  };

  if (compact) {
    const expensesByCategory = getExpensesByCategory();
    
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Expenses ({expenses.length})
            </div>
            <Button
              size="sm"
              onClick={() => setIsAddDialogOpen(true)}
              data-testid="button-add-expense"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {expenses.length > 0 ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between font-medium">
                <span>Total Expenses:</span>
                <span className="font-bold">${getTotalExpenses().toFixed(2)}</span>
              </div>
              {Object.entries(expensesByCategory).map(([category, data]: [string, any]) => {
                const categoryInfo = getCategoryInfo(category);
                return (
                  <div key={category} className="flex justify-between text-xs">
                    <span className="flex items-center gap-1">
                      <categoryInfo.icon className="h-3 w-3" />
                      {categoryInfo.label} ({data.count})
                    </span>
                    <span>${data.total.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No expenses tracked yet
            </div>
          )}
        </CardContent>

        {/* Add/Edit Expense Dialog */}
        <Dialog open={isAddDialogOpen || !!editingExpense} onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            setEditingExpense(null);
          }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingExpense ? 'Edit Expense' : 'Add Expense'}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          setSelectedCategory(value);
                        }} 
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-expense-category">
                            <SelectValue placeholder="Select expense category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {expenseCategories.map((category) => (
                            <SelectItem key={category.value} value={category.value}>
                              <div className="flex items-center gap-2">
                                <category.icon className="h-4 w-4" />
                                {category.label}
                              </div>
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
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., Chainsaw fuel, Wood chipper rental, Safety equipment"
                          data-testid="input-expense-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="1"
                            data-testid="input-expense-quantity"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="unitCost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit Cost ($)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            data-testid="input-expense-unit-cost"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Amount ($)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            data-testid="input-expense-amount"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="vendor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor/Supplier</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="e.g., Home Depot, United Rentals"
                            data-testid="input-expense-vendor"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="date"
                            data-testid="input-expense-date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Additional notes about this expense..."
                          rows={3}
                          data-testid="textarea-expense-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddDialogOpen(false);
                      setEditingExpense(null);
                    }}
                    data-testid="button-cancel-expense"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={addExpenseMutation.isPending}
                    data-testid="button-save-expense"
                  >
                    {addExpenseMutation.isPending ? 'Saving...' : 'Save Expense'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading expenses...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const expensesByCategory = getExpensesByCategory();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6" />
            Expense Management
          </div>
          <Button
            onClick={() => setIsAddDialogOpen(true)}
            data-testid="button-add-expense"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Expense
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-blue-600 text-sm font-medium">Total Expenses</div>
            <div className="text-2xl font-bold text-blue-800">${getTotalExpenses().toFixed(2)}</div>
          </div>
          {Object.entries(expensesByCategory).slice(0, 3).map(([category, data]: [string, any]) => {
            const categoryInfo = getCategoryInfo(category);
            return (
              <div key={category} className={`p-4 rounded-lg ${categoryInfo.color}`}>
                <div className="text-sm font-medium">{categoryInfo.label}</div>
                <div className="text-2xl font-bold">${data.total.toFixed(2)}</div>
                <div className="text-xs">{data.count} items</div>
              </div>
            );
          })}
        </div>

        {/* Expenses List */}
        {expenses.length > 0 ? (
          <div className="space-y-3">
            <h3 className="font-semibold">Expense Entries</h3>
            {expenses.map((expense: any, index: number) => {
              const categoryInfo = getCategoryInfo(expense.category);
              return (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full ${categoryInfo.color}`}>
                      <categoryInfo.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-medium">{expense.description}</div>
                      <div className="text-sm text-gray-600">
                        {categoryInfo.label} • {expense.date}
                        {expense.vendor && ` • ${expense.vendor}`}
                      </div>
                      {expense.quantity && expense.quantity > 1 && (
                        <div className="text-xs text-gray-500">
                          {expense.quantity} × ${expense.unitCost?.toFixed(2) || (expense.amount / expense.quantity).toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">${expense.amount.toFixed(2)}</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingExpense({ ...expense, id: index.toString() })}
                      data-testid={`button-edit-expense-${index}`}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRemoveExpense(index)}
                      disabled={removeExpenseMutation.isPending}
                      data-testid={`button-remove-expense-${index}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No expenses tracked yet</p>
            <p className="text-sm">Add expenses to track job costs accurately</p>
          </div>
        )}

        {/* Add/Edit Expense Dialog */}
        <Dialog open={isAddDialogOpen || !!editingExpense} onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            setEditingExpense(null);
          }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingExpense ? 'Edit Expense' : 'Add Expense'}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          setSelectedCategory(value);
                        }} 
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-expense-category">
                            <SelectValue placeholder="Select expense category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {expenseCategories.map((category) => (
                            <SelectItem key={category.value} value={category.value}>
                              <div className="flex items-center gap-2">
                                <category.icon className="h-4 w-4" />
                                {category.label}
                              </div>
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
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., Chainsaw fuel, Wood chipper rental, Safety equipment"
                          data-testid="input-expense-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="1"
                            data-testid="input-expense-quantity"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="unitCost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit Cost ($)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            data-testid="input-expense-unit-cost"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Amount ($)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            data-testid="input-expense-amount"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="vendor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor/Supplier</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="e.g., Home Depot, United Rentals"
                            data-testid="input-expense-vendor"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="date"
                            data-testid="input-expense-date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Additional notes about this expense..."
                          rows={3}
                          data-testid="textarea-expense-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddDialogOpen(false);
                      setEditingExpense(null);
                    }}
                    data-testid="button-cancel-expense"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={addExpenseMutation.isPending}
                    data-testid="button-save-expense"
                  >
                    {addExpenseMutation.isPending ? 'Saving...' : 'Save Expense'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}