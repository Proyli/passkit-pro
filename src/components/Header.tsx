// src/components/Header.tsx
import { Plus, User, Settings, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link, useNavigate, useLocation } from 'react-router-dom';

const Header = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <header className="glass-effect sticky top-0 z-50 border-b border-white/20">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">P</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                PassKit Pro
              </h1>
              <p className="text-sm text-muted-foreground">Digital Pass Creator</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Link to="/settings">
              <Button
                variant="outline"
                size="sm"
                className={pathname === '/settings' ? 'ring-2 ring-blue-500' : ''}
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </Link>

            {/* NUEVO: Distribution */}
            <Link to="/distribution">
              <Button
                variant="outline"
                size="sm"
                className={pathname === '/distribution' ? 'ring-2 ring-blue-500' : ''}
              >
                <Share2 className="w-4 h-4 mr-2" />
                Distribution
              </Button>
            </Link>

            <Link to="/profile">
              <Button
                variant="outline"
                size="sm"
                className={pathname === '/profile' ? 'ring-2 ring-blue-500' : ''}
              >
                <User className="w-4 h-4 mr-2" />
                Profile
              </Button>
            </Link>

            <Button
              onClick={() => navigate('/designer')}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Pass
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
