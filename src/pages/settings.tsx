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

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
      const response = await fetch("http://localhost:3900/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user?.email,
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
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
          description: data.error || "No se pudo cambiar la contraseña",
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

                {/* Contraseña Actual */}
                <div>
                  <Label htmlFor="currentPassword">Contraseña Actual</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Ingresa tu contraseña actual"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Nueva Contraseña */}
                <div>
                  <Label htmlFor="newPassword">Nueva Contraseña</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Ingresa tu nueva contraseña"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Confirmar Nueva Contraseña */}
                <div>
                  <Label htmlFor="confirmPassword">Confirmar Nueva Contraseña</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirma tu nueva contraseña"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
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
