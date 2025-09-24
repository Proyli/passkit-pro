// src/components/CreatePassForm.tsx
import axios from "axios";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Minus } from "lucide-react";
import PassPreview from "./PassPreview";

interface PassData {
  title: string;
  description: string;
  type: string;
  backgroundColor: string;
  textColor: string;
  fields: Record<string, string>;
}

export type CreatePassFormProps = {
  onCreated?: (id: string) => void;
  onCancel?: () => void;
  initialValues?: Partial<PassData>;
};

const API_BASE_PASSES =
  (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  `${window.location.protocol}//${window.location.hostname}:3900/api`;

const CreatePassForm: React.FC<CreatePassFormProps> = ({
  onCreated,
  onCancel,
  initialValues,
}) => {
  // Estado principal del pase (con initialValues opcionales)
  const [passData, setPassData] = useState<PassData>({
    title: initialValues?.title ?? "Sample Pass",
    description:
      initialValues?.description ?? "This is a sample pass description",
    type: initialValues?.type ?? "coupon",
    backgroundColor: initialValues?.backgroundColor ?? "#007AFF",
    textColor: initialValues?.textColor ?? "#FFFFFF",
    fields:
      initialValues?.fields ?? {
        "Valid Until": "2024-12-31",
        Code: "SAVE20",
      },
  });

  // Campos personalizados visibles en el UI (sincronizados con passData.fields)
  const [customFields, setCustomFields] = useState<
    { key: string; value: string }[]
  >(
    Object.entries(passData.fields).map(([key, value]) => ({ key, value })) || [
      { key: "Valid Until", value: "2024-12-31" },
      { key: "Code", value: "SAVE20" },
    ]
  );

  const addCustomField = () => {
    const nf = [...customFields, { key: "", value: "" }];
    setCustomFields(nf);
    updatePassFields(nf);
  };

  const removeCustomField = (index: number) => {
    const nf = customFields.filter((_, i) => i !== index);
    setCustomFields(nf);
    updatePassFields(nf);
  };

  const updateCustomField = (index: number, key: string, value: string) => {
    const nf = [...customFields];
    nf[index] = { key, value };
    setCustomFields(nf);
    updatePassFields(nf);
  };

  const updatePassFields = (fields: { key: string; value: string }[]) => {
    const fieldsObj = fields.reduce((acc, f) => {
      if (f.key && f.value) acc[f.key] = f.value;
      return acc;
    }, {} as Record<string, string>);
    setPassData((prev) => ({ ...prev, fields: fieldsObj }));
  };

  const updatePassData = (key: keyof PassData, value: string) => {
    setPassData((prev) => ({ ...prev, [key]: value }));
  };

  const setHex =
    (key: "backgroundColor" | "textColor") => (e: React.ChangeEvent<HTMLInputElement>) => {
      let v = String(e.target.value).trim().toUpperCase();
      if (!v.startsWith("#")) v = "#" + v;
      if (v.length > 7) v = v.slice(0, 7);
      setPassData((prev) => ({ ...prev, [key]: v }));
    };

  const setPick =
    (key: "backgroundColor" | "textColor") => (e: React.ChangeEvent<HTMLInputElement>) => {
      setPassData((prev) => ({ ...prev, [key]: e.target.value.toUpperCase() }));
    };

  const handleCreatePass = async () => {
    try {
      const body = {
        title: passData.title,
        description: passData.description,
        type: passData.type || "coupon",
        status: "active",
        backgroundColor: passData.backgroundColor,
        textColor: passData.textColor,
        fields: passData.fields,
      };

      const res = await axios.post(`${API_BASE_PASSES}/passes`, body);
      const data = res.data || {};
      const newId = data.id || data.passId || data.uuid || "";

      // Navegar al detalle (lo maneja el contenedor /passes/new)
      onCreated?.(newId);
    } catch (error: any) {
      console.error("Error al crear el pase:", error);
      const msg =
        error?.response?.data?.message ||
        (typeof error?.response?.data === "string"
          ? error.response.data
          : error?.message) ||
        "Error desconocido";
      alert("❌ Ocurrió un error al guardar el pase: " + msg);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-6">
        <Card className="glass-effect border-white/20">
          <CardHeader>
            <CardTitle>Create New Pass</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="design">Design</TabsTrigger>
                <TabsTrigger value="fields">Fields</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Pass Title</Label>
                  <Input
                    id="title"
                    placeholder="Enter pass title"
                    value={passData.title}
                    onChange={(e) => updatePassData("title", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Enter pass description"
                    value={passData.description}
                    onChange={(e) => updatePassData("description", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Pass Type</Label>
                  <Select
                    value={passData.type}
                    onValueChange={(value) => updatePassData("type", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select pass type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="coupon">Coupon</SelectItem>
                      <SelectItem value="loyalty">Loyalty Card</SelectItem>
                      <SelectItem value="event">Event Ticket</SelectItem>
                      <SelectItem value="boarding">Boarding Pass</SelectItem>
                      <SelectItem value="generic">Generic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="design" className="space-y-4 mt-6">
                <div className="grid grid-cols-2 gap-4">
                  {/* Background */}
                  <div className="space-y-2">
                    <Label htmlFor="bgColor">Background Color</Label>
                    <div className="flex space-x-2">
                      <Input
                        id="bgColor"
                        type="color"
                        value={passData.backgroundColor}
                        onChange={setPick("backgroundColor")}
                        className="w-16 h-10 p-1 rounded-md"
                      />
                      <Input
                        placeholder="#007AFF"
                        value={passData.backgroundColor}
                        onChange={setHex("backgroundColor")}
                      />
                    </div>
                  </div>

                  {/* Text */}
                  <div className="space-y-2">
                    <Label htmlFor="textColor">Text Color</Label>
                    <div className="flex space-x-2">
                      <Input
                        id="textColor"
                        type="color"
                        value={passData.textColor}
                        onChange={setPick("textColor")}
                        className="w-16 h-10 p-1 rounded-md"
                      />
                      <Input
                        placeholder="#FFFFFF"
                        value={passData.textColor}
                        onChange={setHex("textColor")}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="fields" className="space-y-4 mt-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label>Custom Fields</Label>
                    <Button onClick={addCustomField} size="sm" variant="outline">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Field
                    </Button>
                  </div>

                  {customFields.map((field, index) => (
                    <div key={index} className="flex space-x-2 items-end">
                      <div className="flex-1">
                        <Input
                          placeholder="Field name"
                          value={field.key}
                          onChange={(e) =>
                            updateCustomField(index, e.target.value, field.value)
                          }
                        />
                      </div>
                      <div className="flex-1">
                        <Input
                          placeholder="Field value"
                          value={field.value}
                          onChange={(e) =>
                            updateCustomField(index, field.key, e.target.value)
                          }
                        />
                      </div>
                      <Button
                        onClick={() => removeCustomField(index)}
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>

            <div className="mt-6 flex space-x-3">
              <Button
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                onClick={handleCreatePass}
              >
                Create Pass
              </Button>

              <Button variant="outline" onClick={() => onCancel?.()}>
                Save Draft
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:sticky lg:top-24">
        <PassPreview passData={passData} />
      </div>
    </div>
  );
};

export default CreatePassForm;
