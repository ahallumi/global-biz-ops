import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Plus, Clock, User } from 'lucide-react';
import { StaffModeBanner } from '@/components/StaffModeBanner';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';

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
      title: "Clock In/Out",
      description: "Track your work hours",
      icon: Clock,
      onClick: () => {
        // Placeholder for clock-in functionality
        console.log("Clock in/out feature coming soon");
      },
      disabled: true
    },
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
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      {/* Simple Header */}
      <header className="bg-background/80 backdrop-blur-sm border-b border-border/50 sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Package className="h-4 w-4 text-primary" />
              </div>
              <h1 className="text-xl font-semibold text-foreground">Staff Portal</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">{employee.full_name}</p>
                <p className="text-xs text-muted-foreground capitalize">{employee.role}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Staff Mode Banner */}
      <StaffModeBanner />

      <main className="container mx-auto px-6 py-8">
        <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'}`}>
          {actionCards.map((card) => {
            const IconComponent = card.icon;
            return (
              <Card 
                key={card.title}
                className={`border-border/50 cursor-pointer hover:shadow-lg transition-all duration-200 ${
                  card.disabled ? 'opacity-60 cursor-not-allowed' : 'hover:scale-105'
                } ${isMobile ? 'min-h-[140px]' : 'min-h-[160px]'}`}
                onClick={card.disabled ? undefined : card.onClick}
              >
                <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <IconComponent className="h-6 w-6 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <CardTitle className="text-lg font-semibold text-foreground">
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
        </div>
      </main>
    </div>
  );
}