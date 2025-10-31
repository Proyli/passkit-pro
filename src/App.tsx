
// UI y componentes comunes
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

// React Query
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import HealthCheck from "@/components/HealthCheck";

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Páginas
import Login from "./components/Login";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import Members from "./pages/Members";
import DesignerPage from "./pages/DesignerPage";
import Distribution from '@/pages/Distribution';
import PublicRegister from "@/pages/PublicRegister";

// Designer Subpáginas
// Páginas Designer (usa rutas relativas)
import DesignerLayout from "./pages/Designer";
import DesignerApple from "./pages/Designer/Apple";
import DesignerGoogle from "./pages/Designer/components/Google";
import DesignerRegister from "./pages/Designer/Register";
import DesignerDataFields from "./pages/Designer/DataFields";
import DesignerSettings from "./pages/Designer/Settings";

import PassList from "@/pages/PassList";
import PassesCreate from "@/pages/PassesCreate";
import PassDetail from "@/pages/PassDetail";


// Ruta protegida
const PrivateRoute = ({ children }: { children: JSX.Element }) => {
  const isLoggedIn = !!localStorage.getItem("passkit_session");
  return isLoggedIn ? children : <Navigate to="/login" replace />;
};

const queryClient = new QueryClient();

if (import.meta.env.DEV) {
  const once = sessionStorage.getItem("__dev_cleared__");
  if (!once) {
    try { localStorage.removeItem("passkit_session"); } catch {}
    sessionStorage.setItem("__dev_cleared__", "1");
  }
}

const App = () => {
  const isLoggedIn = !!localStorage.getItem("passkit_session");

  return (
    <div className="min-h-screen">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <HealthCheck />
          <BrowserRouter>
            <Routes>
              {/* Redirección automática según login */}
              <Route
                path="/"
                element={
                  isLoggedIn ? (
                    <Navigate to="/dashboard" replace />
                  ) : (
                    <Navigate to="/login" replace />
                  )
                }
              />

              {/* Ruta pública */}
              <Route path="/login" element={<Login />} />

              {/* Rutas protegidas */}
              <Route
                path="/dashboard"
                element={
                  <PrivateRoute>
                    <Dashboard />
                  </PrivateRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <PrivateRoute>
                    <Settings />
                  </PrivateRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <PrivateRoute>
                    <Profile />
                  </PrivateRoute>
                }
              />
              <Route
                path="/members"
                element={
                  <PrivateRoute>
                    <Members />
                  </PrivateRoute>
                }
              />
              <Route path="/register/:slug" 
              element={
              <PublicRegister />
              } 
              />
              <Route
                path="/designer-page"
                element={
                  <PrivateRoute>
                    <DesignerPage />
                  </PrivateRoute>
                }
              />

              {/* Rutas anidadas para Designer */}
              <Route
                path="/designer"
                element={
                  <PrivateRoute>
                    <DesignerLayout />
                  </PrivateRoute>
                }
              >

                <Route index element={<DesignerGoogle />} />
                <Route path="apple" element={<DesignerApple />} />
                <Route path="register" element={<DesignerRegister />} />
                <Route path="data-fields" element={<DesignerDataFields />} />
                <Route path="settings" element={<DesignerSettings />} />
              </Route>

                     <Route
              path="/distribution"
              element={
                <PrivateRoute>
                  <Distribution />
                </PrivateRoute>
              }
            />

              {/* Ruta para no encontrados */}
                           {/* PASSES (protegidas) */}
              <Route
                path="/passes"
                element={
                  <PrivateRoute>
                    <PassList />
                  </PrivateRoute>
                }
              />
              <Route
                path="/passes/new"
                element={
                  <PrivateRoute>
                    <PassesCreate />
                  </PrivateRoute>
                }
              />
              <Route
                path="/passes/:id"
                element={
                  <PrivateRoute>
                    <PassDetail />
                  </PrivateRoute>
                }
              />

              {/* Ruta para no encontrados (siempre la última) */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </div>
  );
};

export default App;
