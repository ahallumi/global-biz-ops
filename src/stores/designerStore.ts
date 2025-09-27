import { create } from 'zustand';
import { TemplateElement } from '@/components/label-designer/LabelDesigner';

interface DesignerState {
  selectedElementId: string | null;
  gridEnabled: boolean;
  snapEnabled: boolean;
  zoom: number;
  showRulers: boolean;
  setSelected: (id: string | null) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  setZoom: (zoom: number) => void;
  toggleRulers: () => void;
}

export const useDesignerStore = create<DesignerState>((set) => ({
  selectedElementId: null,
  gridEnabled: true,
  snapEnabled: true,
  zoom: 1,
  showRulers: true,
  setSelected: (id) => set({ selectedElementId: id }),
  toggleGrid: () => set((state) => ({ gridEnabled: !state.gridEnabled })),
  toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),
  setZoom: (zoom) => set({ zoom }),
  toggleRulers: () => set((state) => ({ showRulers: !state.showRulers })),
}));