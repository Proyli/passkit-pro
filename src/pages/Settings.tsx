import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Home, Shield, Eye, EyeOff } from "lucide-react";
import AdminSettings from "@/components/AdminSettings";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Las contraseñas no coinciden",
        variant: "destructive"
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "La contraseña debe tener al menos 6 caracteres",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data } = await api.post(`/api/auth/change-password`, {
        userId: user?.id,
        currentPassword,
        newPassword,
      });

      if (data) {
        toast({
          title: "Éxito",
          description: "Contraseña actualizada correctamente",
        });

        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast({
          title: "Error",
          description: (data as any)?.error || "No se pudo cambiar la contraseña",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Ocurrió un problema al conectar con el servidor",
        variant: "destructive"
      });
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-semibold text-foreground">Configuraciones</h1>
          <div className="flex gap-3">
            <Button 
              variant="outline"
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2"
            >
              <Home className="w-4 h-4" />
              Menú Principal
            </Button>


          </div>
        </div>

        <Tabs defaultValue="account" className="w-full">
          <TabsList className={`grid w-full ${isAdmin ? "grid-cols-2" : "grid-cols-1"}`}>
            <TabsTrigger value="account">Mi Cuenta</TabsTrigger>
            {isAdmin && <TabsTrigger value="admin">Configuración Admin</TabsTrigger>}
          </TabsList>

          <TabsContent value="account" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Cambiar Contraseña
                </CardTitle>
                <CardDescription>
                  Actualiza tu contraseña para mantener tu cuenta segura
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="currentPassword">Contraseña Actual</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showPasswords ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Ingresa tu contraseña actual"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPasswords(!showPasswords)}
                    >
                      {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="newPassword">Nueva Contraseña</Label>
                  <Input
                    id="newPassword"
                    type={showPasswords ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Ingresa tu nueva contraseña"
                  />
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirmar Nueva Contraseña</Label>
                  <Input
                    id="confirmPassword"
                    type={showPasswords ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirma tu nueva contraseña"
                  />
                </div>

                <Button 
                  onClick={handleChangePassword}
                  className="bg-[#7069e3] hover:bg-[#5f58d1] text-white"
                  disabled={!currentPassword || !newPassword || !confirmPassword}
                >
                  Actualizar Contraseña
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="admin">
              <AdminSettings />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
