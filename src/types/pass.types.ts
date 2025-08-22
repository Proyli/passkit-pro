// src/types/pass.types.ts

export interface Pass {
  id: string;
  title: string;
  type: string;
  description: string;
  backgroundColor?: string;
  textColor?: string;
  createdAt: string;
  scans: number;
  status?: 'active' | 'inactive' | 'expired'; // opcional
  fields?: Record<string, string>;
}

// Tipo que usa el modal de duplicado
export interface DuplicatePayload {
  title: string;
  description: string;
  type: string;
  status?: 'active' | 'inactive' | 'expired'; // ✅ nombre correcto
  backgroundColor?: string;
  textColor?: string;
}

