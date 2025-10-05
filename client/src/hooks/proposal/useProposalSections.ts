import { useState, useCallback } from "react";
import type { ProposalSection, LineItem, UploadedPhoto } from "@/types/proposal";
import { useToast } from "@/hooks/use-toast";
import { calculateLineItemTotal } from "@/utils/proposal/helpers";

export function useProposalSections(initialSections: ProposalSection[] = []) {
  const { toast } = useToast();
  const [sections, setSections] = useState<ProposalSection[]>(initialSections);
  const [activeSectionId, setActiveSectionId] = useState(initialSections[0]?.id || '');

  const addSection = useCallback(() => {
    const newSection: ProposalSection = {
      id: `section-${Date.now()}`,
      title: `Section ${sections.length + 1}`,
      description: '',
      photos: [],
      lineItems: [],
      sortOrder: sections.length + 1
    };
    setSections(prev => [...prev, newSection]);
    setActiveSectionId(newSection.id);
    toast({ title: "Success", description: "New section added" });
  }, [sections.length, toast]);

  const removeSection = useCallback((sectionId: string) => {
    if (sections.length <= 1) {
      toast({
        title: "Cannot Remove",
        description: "At least one section is required",
        variant: "destructive",
      });
      return;
    }
    const newSections = sections.filter(s => s.id !== sectionId);
    setSections(newSections);
    if (activeSectionId === sectionId) {
      setActiveSectionId(newSections[0]?.id || "");
    }
    toast({ title: "Success", description: "Section removed" });
  }, [sections, activeSectionId, toast]);

  const updateSection = useCallback((sectionId: string, updates: Partial<ProposalSection>) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId ? { ...section, ...updates } : section
    ));
  }, []);

  const addLineItem = useCallback((sectionId: string, item: LineItem) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { ...section, lineItems: [...section.lineItems, item] }
        : section
    ));
  }, []);

  const removeLineItem = useCallback((sectionId: string, itemId: string) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { ...section, lineItems: section.lineItems.filter(item => item.id !== itemId) }
        : section
    ));
  }, []);

  const toggleLineItemSelection = useCallback((sectionId: string, itemId: string) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId 
        ? {
            ...section, 
            lineItems: section.lineItems.map(item => 
              item.id === itemId ? { ...item, selected: !item.selected } : item
            )
          }
        : section
    ));
  }, []);

  const updateLineItemChoice = useCallback((sectionId: string, itemId: string, choiceId: string) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId 
        ? {
            ...section, 
            lineItems: section.lineItems.map(item => {
              if (item.id === itemId) {
                const updatedItem = { ...item, selectedChoiceId: choiceId };
                updatedItem.totalPrice = calculateLineItemTotal(updatedItem);
                return updatedItem;
              }
              return item;
            })
          }
        : section
    ));
  }, []);

  const addPhoto = useCallback((sectionId: string, photos: UploadedPhoto[]) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { ...section, photos: [...section.photos, ...photos] }
        : section
    ));
  }, []);

  const removePhoto = useCallback((sectionId: string, photoId: string) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { ...section, photos: section.photos.filter(p => p.id !== photoId) }
        : section
    ));
  }, []);

  return {
    sections,
    setSections,
    activeSectionId,
    setActiveSectionId,
    addSection,
    removeSection,
    updateSection,
    addLineItem,
    removeLineItem,
    toggleLineItemSelection,
    updateLineItemChoice,
    addPhoto,
    removePhoto,
  };
}
