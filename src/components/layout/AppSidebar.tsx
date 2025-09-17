import { useState } from "react"
import { useLocation, Link } from "react-router-dom"
import {
  ChevronRight,
  Home,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Building2,
  Truck,
  Package,
  History,
  Cog,
  DollarSign
} from "lucide-react"

import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"

// Navigation structure
const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: Home,
    roles: ['admin', 'manager'],
  },
  {
    name: 'Staff Dashboard',
    href: '/staff-dashboard',
    icon: BarChart3,
    roles: ['staff'],
  },
  {
    name: 'Clock In/Out',
    href: '/clock',
    icon: BarChart3,
    roles: ['staff', 'admin', 'manager'],
  },
  {
    name: 'Employees',
    href: '/employees',
    icon: Users,
    roles: ['admin'],
  },
  {
    name: 'Payroll',
    href: '/payroll',
    icon: DollarSign,
    roles: ['admin'],
  },
  {
    name: 'Intakes',
    href: '/intakes',
    icon: Truck,
    roles: ['admin', 'staff', 'manager'],
  },
  {
    name: 'Suppliers',
    href: '/suppliers',
    icon: Building2,
    roles: ['admin', 'manager', 'staff'],
  },
  {
    name: 'Products',
    href: '/products',
    icon: Package,
    roles: ['admin', 'manager', 'staff'],
  },
  {
    name: 'Sync Queue',
    href: '/sync-queue',
    icon: History,
    roles: ['admin', 'manager', 'staff'],
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: ['admin'],
  },
  {
    name: 'Users',
    href: '/users',
    icon: Users,
    roles: ['admin'],
  },
  {
    name: 'Reports',
    href: '/reports',
    icon: BarChart3,
    roles: ['admin', 'manager'],
  },
]

export function AppSidebar() {
  const { employee, signOut } = useAuth()
  const location = useLocation()
  const { state } = useSidebar()
  
  // Filter navigation based on user role
  const filteredNavigation = navigation.filter(item =>
    employee?.role && item.roles.includes(employee.role)
  )

  const isActive = (path: string) => location.pathname === path

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Building2 className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Company Portal</span>
                <span className="truncate text-xs">Enterprise</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredNavigation.map((item) => {
                const active = isActive(item.href)
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link to={item.href}>
                        <item.icon />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {employee?.full_name || 'Employee'}
                </span>
                <span className="truncate text-xs capitalize">
                  {employee?.role}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => signOut()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {state === "expanded" && "Sign Out"}
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}