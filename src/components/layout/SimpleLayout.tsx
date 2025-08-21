
import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { EnhancedHeader } from './EnhancedHeader';
import { SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

interface SimpleLayoutProps {
  children: ReactNode;
}

export function SimpleLayout({ children }: SimpleLayoutProps) {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full bg-background">
        <EnhancedHeader />
        <main className="flex-1 p-6 space-y-4">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
