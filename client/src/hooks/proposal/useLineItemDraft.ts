import { useState, useCallback } from "react";
import type { LineItem, LineItemChoice } from "@/types/proposal";
import { useToast } from "@/hooks/use-toast";
import { calculateLineItemTotal } from "@/utils/proposal/helpers";

const initialDraft: Partial<LineItem> = {
  description: "",
  quantity: 1,
  unitPrice: 0,
  unit: "each",
  category: "labor",
  notes: "",
  isOptional: false,
  pricingType: "normal",
  choices: [],
  selectedChoiceId: undefined,
  fixedPrice: undefined,
};

export function useLineItemDraft() {
  const { toast } = useToast();
  const [draft, setDraft] = useState<Partial<LineItem>>(initialDraft);
  const [currentChoice, setCurrentChoice] = useState<Partial<LineItemChoice>>({
    label: "",
    description: "",
    price: 0,
    isDefault: false,
  });

  const updateDraft = useCallback((updates: Partial<LineItem>) => {
    setDraft(prev => ({ ...prev, ...updates }));
  }, []);

  const addChoice = useCallback(() => {
    if (!currentChoice.label || !currentChoice.price) {
      toast({
        title: "Validation Error",
        description: "Please fill in choice label and price",
        variant: "destructive",
      });
      return false;
    }

    const newChoice: LineItemChoice = {
      id: `choice-${Date.now()}`,
      label: currentChoice.label || "",
      description: currentChoice.description || "",
      price: currentChoice.price || 0,
      isDefault: currentChoice.isDefault || false,
    };

    setDraft(prev => ({
      ...prev,
      choices: [...(prev.choices || []), newChoice],
      pricingType: "choice",
      selectedChoiceId: newChoice.isDefault ? newChoice.id : prev.selectedChoiceId,
    }));

    setCurrentChoice({ label: "", description: "", price: 0, isDefault: false });
    toast({ title: "Success", description: "Choice option added" });
    return true;
  }, [currentChoice, toast]);

  const removeChoice = useCallback((choiceId: string) => {
    setDraft(prev => {
      const newChoices = (prev.choices || []).filter(choice => choice.id !== choiceId);
      return {
        ...prev,
        choices: newChoices,
        pricingType: newChoices.length > 0 ? "choice" : "normal",
        selectedChoiceId: prev.selectedChoiceId === choiceId ? newChoices[0]?.id : prev.selectedChoiceId,
      };
    });
  }, []);

  const validateAndBuild = useCallback((): LineItem | null => {
    if (!draft.description) {
      toast({
        title: "Validation Error",
        description: "Please provide a description",
        variant: "destructive",
      });
      return null;
    }

    if (draft.pricingType === "choice" && (!draft.choices || draft.choices.length === 0)) {
      toast({
        title: "Validation Error",
        description: "Please add at least one choice option",
        variant: "destructive",
      });
      return null;
    }

    if (draft.pricingType === "normal" && (!draft.quantity || !draft.unitPrice)) {
      toast({
        title: "Validation Error",
        description: "Please fill in quantity and unit price",
        variant: "destructive",
      });
      return null;
    }

    if (draft.pricingType === "fixed" && (!draft.fixedPrice || draft.fixedPrice <= 0)) {
      toast({
        title: "Validation Error",
        description: "Please provide a valid fixed price",
        variant: "destructive",
      });
      return null;
    }

    const defaultChoiceId = draft.pricingType === "choice" 
      ? draft.choices?.find(choice => choice.isDefault)?.id || draft.choices?.[0]?.id
      : undefined;

    const itemWithChoice = { ...draft, selectedChoiceId: defaultChoiceId };
    const totalPrice = calculateLineItemTotal(itemWithChoice);

    return {
      id: `item-${Date.now()}`,
      description: draft.description || "",
      quantity: draft.quantity || 1,
      unitPrice: draft.unitPrice || 0,
      totalPrice,
      unit: draft.unit || "each",
      category: draft.category,
      notes: draft.notes,
      isOptional: draft.isOptional || false,
      selected: true,
      pricingType: draft.pricingType || "normal",
      choices: draft.choices || [],
      selectedChoiceId: defaultChoiceId,
      fixedPrice: draft.fixedPrice,
    };
  }, [draft, toast]);

  const reset = useCallback(() => {
    setDraft(initialDraft);
    setCurrentChoice({ label: "", description: "", price: 0, isDefault: false });
  }, []);

  return {
    draft,
    updateDraft,
    currentChoice,
    setCurrentChoice,
    addChoice,
    removeChoice,
    validateAndBuild,
    reset,
  };
}
