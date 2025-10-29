import { api } from "@/utils/api";

export type AssignCardPayload = {
  codigoCliente: string;
  codigoCampana: string;
};

export const CardsService = {
  assignCard: (payload: AssignCardPayload) =>
    api.post("/api/cards", payload).then((r) => r.data),
};

