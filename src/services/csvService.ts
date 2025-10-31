import { api } from "@/lib/api";

export const CsvService = {
  exportCsv: () =>
    api.get<Blob>("/api/csv/export", { responseType: "blob" }).then((r) => r.data),

  importCsv: (file: File) => {
    const form = new FormData();
    // La API actual espera el campo "csvFile"
    form.append("csvFile", file);
    return api
      .post("/api/csv/import", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
};
