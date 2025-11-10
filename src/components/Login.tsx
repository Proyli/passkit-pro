// src/components/Login.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { LogIn, Shield, User, Eye, EyeOff } from 'lucide-react';
import { useAuth } from "@/context/AuthContext";
import { AuthService } from "@/services/authService"; // ✅ usa el backend

interface LoginCredentials {
  email: string;
  password: string;
  role: 'admin' | 'user';
}

const Login = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setUser } = useAuth();

  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: '',
    role: 'user',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // 🔐 Llamada real al backend (POST /api/auth/login)
      const data = await AuthService.login({
        email: credentials.email,
        password: credentials.password,
      });

      // data: { token, user: { id, name, role } }
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Si tu AuthContext espera otro shape, adapta aquí:
      setUser({
        id: data.user.id,
        name: data.user.name,
        role: data.user.role,
        email: credentials.email,
      } as any);

      // Sesión “histórica” que ya usabas (si quieres mantenerla)
      localStorage.setItem(
        "passkit_session",
        JSON.stringify({
          email: credentials.email,
          role: data.user.role,
          loginTime: new Date().toISOString(),
        })
      );

      toast({
        title: "Login exitoso",
        description: `Bienvenido ${data.user.role === 'admin' ? 'Administrador' : 'Usuario'}.`,
      });

      navigate('/dashboard');
    } catch (err: any) {
      // Mensaje desde backend o genérico
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Credenciales inválidas o servidor no disponible.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof LoginCredentials, value: string) => {
    setCredentials(prev => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/10 p-4">
      <Card className="w-full max-w-md glass-effect border-white/20">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-gradient-to-r from-primary to-secondary rounded-full flex items-center justify-center mb-4">
            <LogIn className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">PassKit Pro</CardTitle>
          <CardDescription>
            Sign in to manage your digital passes
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="role">Account Type</Label>
              <Select
                value={credentials.role}
                onValueChange={(value: 'admin' | 'user') => handleInputChange('role', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Standard User
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Administrator
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={credentials.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={credentials.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Info visible (opcional): puedes quitarla si ya usas backend */}
            <div className="bg-muted/50 p-3 rounded-lg text-sm">
              <p className="font-medium mb-2">Access Information:</p>
              <div className="space-y-1 text-muted-foreground">
                <p><strong>Admin:</strong> admin@alcazaren.com.gt</p>
                <p><strong>Standard Users:</strong></p>
                <ul className="text-xs ml-2 space-y-0.5">
                  <li>• andrea@alcazaren.com.gt</li>
                  <li>• ventas1.digital@alcazaren.com.gt</li>
                  <li>• julio@alcazaren.com.gt</li>
                </ul>
              </div>
            </div>
          </CardContent>

          <CardFooter>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !credentials.email || !credentials.password}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Login;
