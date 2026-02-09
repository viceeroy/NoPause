import { useLocation, useNavigate } from 'react-router-dom';
import { Home, BookOpen, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/prompts', icon: BookOpen, label: 'Prompts' },
  { path: '/stats', icon: BarChart3, label: 'Stats' },
];

export const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav
      data-testid="main-navbar"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-3 py-2 bg-white/80 backdrop-blur-xl border border-sand-300/50 rounded-full shadow-float"
    >
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        const Icon = item.icon;
        return (
          <button
            key={item.path}
            data-testid={`nav-${item.label.toLowerCase()}`}
            onClick={() => navigate(item.path)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-full font-sans text-sm font-medium btn-press',
              'transition-colors duration-200',
              isActive
                ? 'bg-sage-500 text-white'
                : 'text-muted-foreground hover:text-foreground hover:bg-sand-200'
            )}
          >
            <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
            {isActive && <span>{item.label}</span>}
          </button>
        );
      })}
    </nav>
  );
};
