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
      className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-0.5 sm:gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white/80 backdrop-blur-xl border border-sand-300/50 rounded-full shadow-float"
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
              'flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full font-sans text-xs sm:text-sm font-medium btn-press',
              'transition-colors duration-200',
              isActive
                ? 'bg-sage-500 text-white'
                : 'text-muted-foreground hover:text-foreground hover:bg-sand-200'
            )}
          >
            <Icon size={14} className="sm:hidden" strokeWidth={isActive ? 2.5 : 2} />
            <Icon size={18} className="hidden sm:block" strokeWidth={isActive ? 2.5 : 2} />
            {isActive && <span className="hidden sm:inline">{item.label}</span>}
          </button>
        );
      })}
    </nav>
  );
};
