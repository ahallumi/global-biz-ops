import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Menu,
  LayoutDashboard,
  Package,
  ClipboardCheck,
  Users,
  Warehouse,
  Settings,
  LogOut,
  Clock,
  DollarSign,
  BarChart3,
  Truck,
  Package2,
  RefreshCw
} from 'lucide-react';

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['admin', 'manager']
  },
  {
    name: 'Staff Dashboard',
    href: '/staff-dashboard',
    icon: LayoutDashboard,
    roles: ['staff']
  },
  {
    name: 'Time Clock',
    href: '/clock',
    icon: Clock,
    roles: ['admin', 'staff', 'manager']
  },
  {
    name: 'Intakes',
    href: '/intakes',
    icon: Package,
    roles: ['admin', 'staff', 'manager']
  },
  {
    name: 'Products',
    href: '/products',
    icon: Package2,
    roles: ['admin', 'staff', 'manager']
  },
  {
    name: 'Suppliers',
    href: '/suppliers',
    icon: Truck,
    roles: ['admin', 'staff', 'manager']
  },
  {
    name: 'Employees',
    href: '/employees',
    icon: Users,
    roles: ['admin']
  },
  {
    name: 'Payroll',
    href: '/payroll',
    icon: DollarSign,
    roles: ['admin']
  },
  {
    name: 'Reports',
    href: '/reports',
    icon: BarChart3,
    roles: ['admin', 'manager']
  },
  {
    name: 'Sync Queue',
    href: '/sync-queue',
    icon: RefreshCw,
    roles: ['admin', 'staff', 'manager']
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: ['admin']
  }
];

export function MobileNavigation() {
  const { employee, signOut } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  if (!employee) return null;

  const filteredNavigation = navigation.filter(item =>
    item.roles.includes(employee.role)
  );

  const handleSignOut = () => {
    signOut();
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80">
        <SheetHeader className="pb-6">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                <Package className="w-4 h-4 text-primary-foreground" />
              </div>
              Staff Hub
            </SheetTitle>
          </div>
          <div className="flex flex-col gap-2 pt-4">
            <div className="text-sm font-medium text-foreground">
              {employee.full_name}
            </div>
            <Badge variant="secondary" className="w-fit text-xs">
              {employee.role}
            </Badge>
          </div>
        </SheetHeader>
        
        <nav className="flex flex-col space-y-2">
          {filteredNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setOpen(false)}
              >
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3 h-12",
                    isActive && "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {item.name}
                </Button>
              </Link>
            );
          })}
          
          <div className="pt-4 mt-4 border-t border-border">
            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="w-full justify-start gap-3 h-12 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </Button>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}