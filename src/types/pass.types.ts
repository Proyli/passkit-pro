// src/types/pass.types.ts

export interface Pass {
  id: string;
  title: string;
  type: string;
  description: string;

  backgroundColor?: string;
  textColor?: string;

  // hazlos opcionales para que no truene si la API no los manda en algún momento
  createdAt?: string;
  scans?: number;

  status?: 'active' | 'inactive' | 'expired' | string;
  fields?: Record<string, any>;

  // 👇 nuevo: el member relacionado al pass (opcional)
  member?: {
    id: number;
    codigoCliente: string;
    codigoCampana: string;
  } | null;
}

// Tipo que usa el modal de duplicado
export interface DuplicatePayload {
  title: string;
  description: string;
  type: string;
  status?: 'active' | 'inactive' | 'expired';
  backgroundColor?: string;
  textColor?: string;
}
