import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "@/components/theme/theme-provider";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import StaffLogin from "./pages/StaffLogin";
import AdminLogin from "./pages/AdminLogin";
import Dashboard from "./pages/Dashboard";
import StaffDashboard from "./pages/StaffDashboard";
import ClockPage from "./pages/ClockPage";
import IntakesPage from "./pages/IntakesPage";
import NewIntakePage from "./pages/NewIntakePage";
import IntakeDetailPage from "./pages/IntakeDetailPage";
import SuppliersPage from "./pages/SuppliersPage";
import SettingsPage from "./pages/SettingsPage";
import InventorySettingsPage from "./pages/settings/InventorySettingsPage";
import StationSettingsPage from "./pages/settings/StationSettingsPage";
import ProductsPage from "./pages/ProductsPage";
import SyncQueuePage from "./pages/SyncQueuePage";
import StationLoginPage from "./pages/StationLoginPage";
import StationPage from "./pages/StationPage";
import StationClockPage from "./pages/StationClockPage";
import StationIntakePage from "./pages/StationIntakePage";
import StationInventoryPage from "./pages/StationInventoryPage";
import StationStaffPage from "./pages/StationStaffPage";
import { StationRoute } from "./components/StationRoute";
import NotFound from "./pages/NotFound";
import StationDebugPage from "./pages/StationDebugPage";
import PayrollPage from "./pages/PayrollPage";
import ReportsPage from "./pages/ReportsPage";
import EmployeesPage from "./pages/EmployeesPage";
import NewEmployeePage from "./pages/NewEmployeePage";
import { EmployeeDetailPage } from "./pages/EmployeeDetailPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/staff-login" element={<StaffLogin />} />
            <Route path="/admin-login" element={<AdminLogin />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute requiredRoles={['admin', 'manager']}>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/staff-dashboard" 
              element={
                <ProtectedRoute requiredRoles={['staff', 'admin', 'manager']}>
                  <StaffDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/clock" 
              element={
                <ProtectedRoute requiredRoles={['staff', 'admin', 'manager']}>
                  <ClockPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/intakes" 
              element={
                <ProtectedRoute requiredRoles={['admin', 'staff', 'manager']}>
                  <IntakesPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/intakes/new" 
              element={
                <ProtectedRoute requiredRoles={['admin', 'staff', 'manager']}>
                  <NewIntakePage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/intakes/:id" 
              element={
                <ProtectedRoute requiredRoles={['admin', 'staff', 'manager']}>
                  <IntakeDetailPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/suppliers" 
              element={
                <ProtectedRoute requiredRoles={['admin', 'manager', 'staff']}>
                  <SuppliersPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/suppliers/new" 
              element={
                <ProtectedRoute requiredRoles={['admin', 'manager']}>
                  <SuppliersPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/suppliers/:id/edit" 
              element={
                <ProtectedRoute requiredRoles={['admin', 'manager']}>
                  <SuppliersPage />
                </ProtectedRoute>
              } 
            />
            <Route path="/settings" element={
              <ProtectedRoute requiredRoles={['admin']}>
                <SettingsPage />
              </ProtectedRoute>
            } />
            <Route path="/settings/inventory" element={
              <ProtectedRoute requiredRoles={['admin']}>
                <InventorySettingsPage />
              </ProtectedRoute>
            } />
            <Route path="/settings/station" element={
              <ProtectedRoute requiredRoles={['admin']}>
                <StationSettingsPage />
              </ProtectedRoute>
            } />
            <Route path="/payroll" element={
              <ProtectedRoute requiredRoles={['admin']}>
                <PayrollPage />
              </ProtectedRoute>
            } />
            <Route path="/reports" element={
              <ProtectedRoute requiredRoles={['admin', 'manager']}>
                <ReportsPage />
              </ProtectedRoute>
            } />
            <Route path="/employees" element={
              <ProtectedRoute requiredRoles={['admin']}>
                <EmployeesPage />
              </ProtectedRoute>
            } />
            <Route path="/employees/new" element={
              <ProtectedRoute requiredRoles={['admin']}>
                <NewEmployeePage />
              </ProtectedRoute>
            } />
            <Route path="/employees/:id" element={
              <ProtectedRoute requiredRoles={['admin']}>
                <EmployeeDetailPage />
              </ProtectedRoute>
            } />
            <Route 
              path="/products" 
              element={
                <ProtectedRoute requiredRoles={['admin', 'manager', 'staff']}>
                  <ProductsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/sync-queue" 
              element={
                <ProtectedRoute requiredRoles={['admin', 'manager', 'staff']}>
                  <SyncQueuePage />
                </ProtectedRoute>
              } 
            />
            {/* Station routes */}
            <Route path="/station-login" element={<StationLoginPage />} />
            <Route 
              path="/station" 
              element={
                <StationRoute>
                  <StationPage />
                </StationRoute>
              } 
            />
            <Route 
              path="/station/clock" 
              element={
                <StationRoute>
                  <StationClockPage />
                </StationRoute>
              } 
            />
            <Route 
              path="/station/intake" 
              element={
                <StationRoute>
                  <StationIntakePage />
                </StationRoute>
              } 
            />
            <Route 
              path="/station/inventory" 
              element={
                <StationRoute>
                  <StationInventoryPage />
                </StationRoute>
              } 
            />
            <Route 
              path="/station/staff" 
              element={
                <StationRoute>
                  <StationStaffPage />
                </StationRoute>
              } 
            />
            {/* Redirect to dashboard for authenticated users */}
            <Route path="/app" element={<Navigate to="/dashboard" replace />} />
            {/* Debug route for station session checks */}
            <Route path="/station-debug" element={<StationDebugPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
