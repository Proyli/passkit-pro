import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { LogIn, Shield, User } from 'lucide-react';
import { useAuth } from "@/context/AuthContext";
import { nanoid } from 'nanoid';



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
    role: 'user'
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // System credentials - Only authorized personnel
  const testCredentials = {
    admin: { email: 'admin@alcazaren.com.gt', password: 'admin123' },
    users: [
      'andrea@alcazaren.com.gt',
      'julio@alcazaren.com.gt', 
      'linda.perez@alcazaren.com.gt'
    ]
  };

  const allowedUserEmails = [
  'linda.perez@alcazaren.com.gt'
];


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Validate credentials
    let isValidUser = false;
    
    if (credentials.role === 'admin') {
      isValidUser = credentials.email === testCredentials.admin.email && 
                   credentials.password === testCredentials.admin.password;
    } else {
      // For standard users, check if email is in allowed list and use standard password
      isValidUser = testCredentials.users.includes(credentials.email) && 
                   credentials.password === 'user123';
    }
    
    if (isValidUser) {
      // Store session in localStorage (prepare for future backend integration)
      const sessionData = {
  id: nanoid(12), // ✅ ID generado automáticamente
  email: credentials.email,
  role: credentials.role,
  loginTime: new Date().toISOString()
};

setUser(sessionData);
localStorage.setItem("passkit_session", JSON.stringify(sessionData));

  toast({
        title: "Login successful",
        description: `Welcome ${credentials.role === 'admin' ? 'Administrator' : 'User'}!`,
      });

   
        navigate('/dashboard'); // ahora tanto admin como user van al dashboard


    } else {
      setError('Access denied. Only authorized personnel can access this system.');
    }

    const testCred = testCredentials[credentials.role];

// Validar usuario estándar por correo
if (
  credentials.role === "user" &&
  allowedUserEmails.includes(credentials.email) &&
  credentials.password === testCred.password
) {
  localStorage.setItem('passkit_session', JSON.stringify({
    email: credentials.email,
    role: credentials.role,
    loginTime: new Date().toISOString()
  }));

  toast({
    title: "Login exitoso",
    description: `Bienvenido ${credentials.email}`,
  });

  navigate('/dashboard');
  setIsLoading(false);
  return;
}

// Validar administrador
if (
  credentials.role === "admin" &&
  credentials.email === testCred.email &&
  credentials.password === testCred.password
) {
  localStorage.setItem('passkit_session', JSON.stringify({
    email: credentials.email,
    role: credentials.role,
    loginTime: new Date().toISOString()
  }));

  toast({
    title: "Login exitoso",
    description: `Bienvenido administrador`,
  });

  navigate('/dashboard');
  setIsLoading(false);
  return;
}

// Si ninguna validación pasó
setError("Credenciales inválidas.");
setIsLoading(false);
  };

  const handleInputChange = (field: keyof LoginCredentials, value: string) => {
    setCredentials(prev => ({ ...prev, [field]: value }));
    if (error) setError(''); // Clear error when user starts typing
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
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={credentials.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                required
              />
            </div>

            {/* Authorized users info */}
            <div className="bg-muted/50 p-3 rounded-lg text-sm">
              <p className="font-medium mb-2">Access Information:</p>
              <div className="space-y-1 text-muted-foreground">
                <p><strong>Admin:</strong> admin@alcazaren.com.gt</p>
                <p><strong>Standard Users:</strong></p>
                <ul className="text-xs ml-2 space-y-0.5">
                  <li>• andrea@alcazaren.com.gt</li>
                  <li>• julio@alcazaren.com.gt</li>
                  <li>• linda.perez@alcazaren.com.gt</li>
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