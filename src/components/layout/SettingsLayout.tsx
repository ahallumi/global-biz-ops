import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Package, Shield, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SettingsLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

export function SettingsLayout({ children, title, description }: SettingsLayoutProps) {
  const location = useLocation();

  const settingsNav = [
    {
      name: 'Inventory',
      href: '/settings/inventory',
      icon: Package,
    },
    {
      name: 'Station Access',
      href: '/settings/station',
      icon: Shield,
    },
    {
      name: 'Printing',
      href: '/settings/printing',
      icon: Printer,
    }
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/settings" className="flex items-center gap-2">
              <ChevronLeft className="h-4 w-4" />
              Back to Settings
            </Link>
          </Button>
        </div>

        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>

        {/* Settings Navigation */}
        <div className="flex gap-1 border-b border-border">
          {settingsNav.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Button
                key={item.name}
                variant="ghost"
                size="sm"
                asChild
                className={cn(
                  "rounded-b-none border-b-2 border-transparent",
                  isActive && "border-primary bg-primary/5"
                )}
              >
                <Link to={item.href} className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              </Button>
            );
          })}
        </div>

        {/* Content */}
        <div>{children}</div>
      </div>
    </Layout>
  );
}