import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Package,
  ClipboardCheck,
  Users,
  Warehouse,
  Settings
} from 'lucide-react';

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['admin', 'staff', 'manager']
  },
  {
    name: 'Product Intake',
    href: '/product-intake',
    icon: Package,
    roles: ['admin', 'staff', 'manager']
  },
  {
    name: 'Review Intakes',
    href: '/review',
    icon: ClipboardCheck,
    roles: ['admin']
  },
  {
    name: 'Inventory',
    href: '/inventory',
    icon: Warehouse,
    roles: ['admin']
  },
  {
    name: 'Employees',
    href: '/employees',
    icon: Users,
    roles: ['admin']
  }
];

export function Sidebar() {
  const { employee } = useAuth();
  const location = useLocation();

  const filteredNavigation = navigation.filter(item =>
    employee ? item.roles.includes(employee.role) : false
  );

  return (
    <div className="w-64 bg-card border-r border-border h-screen">
      <div className="p-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
            <Package className="w-4 h-4 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Staff Hub</h1>
        </div>
      </div>
      
      <nav className="px-3 space-y-1">
        {filteredNavigation.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;
          
          return (
            <Link key={item.name} to={item.href}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 h-11",
                  isActive && "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                <Icon className="w-5 h-5" />
                {item.name}
              </Button>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}