import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Plus, Clock } from 'lucide-react';
import { StaffModeBanner } from '@/components/StaffModeBanner';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { Layout } from '@/components/layout/Layout';
import { ClockCard } from '@/components/clock/ClockCard';
import { TodaySummaryCard } from '@/components/clock/TodaySummaryCard';

export default function StaffDashboard() {
  const { employee } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  if (!employee) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse">
          <div className="h-8 w-32 bg-muted rounded mb-4"></div>
          <div className="h-4 w-48 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  const actionCards = [
    {
      title: "New Order Intake",
      description: "Add new product intake",
      icon: Plus,
      onClick: () => navigate('/intakes/new')
    },
    {
      title: "Intake Orders Processing",
      description: "View and manage intakes",
      icon: Package,
      onClick: () => navigate('/intakes')
    }
  ];

  return (
    <Layout>
      {/* Staff Mode Banner */}
      <StaffModeBanner />

      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Welcome back, {employee.full_name.split(' ')[0]}!</h2>
          <p className="text-muted-foreground">Manage your time and intake submissions</p>
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Clock In/Out Card */}
          <ClockCard />

          {/* Today's Summary Card */}
          <TodaySummaryCard />

          {/* Quick Actions Card */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Access common tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {actionCards.map((card) => {
                const IconComponent = card.icon;
                return (
                  <Card 
                    key={card.title}
                    className="border-border/50 cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-105"
                    onClick={card.onClick}
                  >
                    <CardContent className="flex items-center p-4 space-x-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <IconComponent className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base font-medium text-foreground">
                          {card.title}
                        </CardTitle>
                        <CardDescription className="text-sm text-muted-foreground">
                          {card.description}
                        </CardDescription>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}