// src/types/dom-augmentations.d.ts
// Permite usar input.showPicker() sin errores de TS
interface HTMLInputElement {
  showPicker?: () => void;
}

