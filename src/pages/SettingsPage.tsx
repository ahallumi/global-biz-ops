import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Shield, Users, BarChart3, DollarSign, Building2, Clock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function SettingsPage() {
  const { employee } = useAuth();
  
  const settingsCards = [
    {
      title: 'Inventory Settings',
      description: 'Configure Square POS integration and product sync automation',
      icon: Package,
      href: '/settings/inventory',
      roles: ['admin'],
      status: 'Connected'
    },
    {
      title: 'Station Settings', 
      description: 'Manage station access codes and terminal configurations',
      icon: Shield,
      href: '/settings/station',
      roles: ['admin'],
      status: 'Active'
    },
    {
      title: 'Payroll Settings',
      description: 'Configure payroll calculation rules and overtime policies',
      icon: DollarSign,
      href: '/settings/payroll',
      roles: ['admin'],
      status: 'Active'
    },
    {
      title: 'Time Settings',
      description: 'Configure timezone, time tracking rules, and clock settings',
      icon: Clock,
      href: '/settings/time',
      roles: ['admin'],
      status: 'Active'
    },
    {
      title: 'User Management',
      description: 'Manage employee accounts, roles, and permissions',
      icon: Users,
      href: '/settings/users',
      roles: ['admin'],
      status: 'Coming Soon',
      disabled: true
    },
    {
      title: 'Reports Settings',
      description: 'Configure automated reports and analytics preferences',
      icon: BarChart3,
      href: '/settings/reports',
      roles: ['admin', 'manager'],
      status: 'Coming Soon',
      disabled: true
    },
    {
      title: 'General Settings',
      description: 'Company information, time zones, and system preferences',
      icon: Building2,
      href: '/settings/general',
      roles: ['admin'],
      status: 'Coming Soon',
      disabled: true
    }
  ];

  // Filter settings based on user role
  const filteredSettings = settingsCards.filter(setting =>
    employee?.role && setting.roles.includes(employee.role)
  );

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your application settings and configurations
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSettings.map((setting) => {
            const Icon = setting.icon;
            return (
              <Card
                key={setting.title}
                className={`transition-all hover:shadow-md ${
                  setting.disabled 
                    ? 'opacity-60 cursor-not-allowed' 
                    : 'hover:shadow-elegant cursor-pointer'
                }`}
              >
                {setting.disabled ? (
                  <div className="p-6">
                    <CardHeader className="p-0 pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-muted">
                            <Icon className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{setting.title}</CardTitle>
                          </div>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground">
                          {setting.status}
                        </span>
                      </div>
                    </CardHeader>
                    <CardDescription>{setting.description}</CardDescription>
                  </div>
                ) : (
                  <Link to={setting.href} className="block">
                    <div className="p-6">
                      <CardHeader className="p-0 pb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                              <Icon className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{setting.title}</CardTitle>
                            </div>
                          </div>
                          <span className="text-xs px-2 py-1 rounded-md bg-success/10 text-success">
                            {setting.status}
                          </span>
                        </div>
                      </CardHeader>
                      <CardDescription>{setting.description}</CardDescription>
                    </div>
                  </Link>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}