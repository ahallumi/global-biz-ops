import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AppSidebar } from './AppSidebar';
import { EnhancedHeader } from './EnhancedHeader';
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
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
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <EnhancedHeader />
          <main className="flex-1 p-6 space-y-4">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}