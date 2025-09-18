import { useState } from 'react';
import { Plus, Users, Shield, Eye, EyeOff, MoreHorizontal } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useUsers, useDeleteUser, User } from '@/hooks/useUsers';
import { UserDialog } from '@/components/users/UserDialog';
import { Skeleton } from '@/components/ui/skeleton';

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const { data: users, isLoading } = useUsers({ 
    search: search || undefined, 
    role: roleFilter === 'all' ? undefined : roleFilter 
  });
  const deleteUser = useDeleteUser();

  const handleDeleteUser = async (user: User) => {
    await deleteUser.mutateAsync(user.id);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadge = (role: string) => {
    return (
      <Badge variant={role === 'admin' ? 'destructive' : 'secondary'}>
        {role === 'admin' ? (
          <>
            <Shield className="h-3 w-3 mr-1" />
            Admin
          </>
        ) : (
          'Staff'
        )}
      </Badge>
    );
  };

  const getAccessBadge = (hasAccess: boolean) => {
    return (
      <Badge variant={hasAccess ? 'default' : 'outline'}>
        {hasAccess ? (
          <>
            <Eye className="h-3 w-3 mr-1" />
            Enabled
          </>
        ) : (
          <>
            <EyeOff className="h-3 w-3 mr-1" />
            Disabled
          </>
        )}
      </Badge>
    );
  };

  const handleOpenUserDialog = (user?: User) => {
    setSelectedUser(user || null);
    setUserDialogOpen(true);
  };

  const handleCloseUserDialog = () => {
    setSelectedUser(null);
    setUserDialogOpen(false);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-10 w-24" />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </Layout>
    );
  }

  const totalUsers = users?.length || 0;
  const adminUsers = users?.filter(u => u.role === 'admin').length || 0;
  const staffUsers = users?.filter(u => u.role === 'staff').length || 0;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground">
              Manage user accounts and access permissions
            </p>
          </div>
          <Button onClick={() => handleOpenUserDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Admin Users</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{adminUsers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Staff Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{staffUsers}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Employee Link</TableHead>
                  <TableHead>Online Access</TableHead>
                  <TableHead>Last Sign In</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {getInitials(user.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{user.full_name}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>
                      {user.employee_name ? (
                        <div className="text-sm">
                          <div className="font-medium">{user.employee_name}</div>
                          <div className="text-muted-foreground">Linked</div>
                        </div>
                      ) : (
                        <Badge variant="outline">No Employee</Badge>
                      )}
                    </TableCell>
                    <TableCell>{getAccessBadge(user.online_access_enabled)}</TableCell>
                    <TableCell>
                      {user.last_sign_in_at ? (
                        <div className="text-sm text-muted-foreground">
                          {new Date(user.last_sign_in_at).toLocaleDateString()}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenUserDialog(user)}>
                            Edit User
                          </DropdownMenuItem>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem 
                                className="text-destructive"
                                onSelect={(e) => e.preventDefault()}
                              >
                                Delete User
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete User</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete {user.full_name}? This will remove their user account and unlink them from any employee record. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteUser(user)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete User
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {!users || users.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">No users found</h3>
                <p className="text-muted-foreground mb-4">
                  {search || (roleFilter && roleFilter !== 'all') 
                    ? "No users match your current filters." 
                    : "Get started by adding your first user account."
                  }
                </p>
                {(!search && (!roleFilter || roleFilter === 'all')) && (
                  <Button onClick={() => handleOpenUserDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* User Dialog */}
        <UserDialog
          open={userDialogOpen}
          onOpenChange={setUserDialogOpen}
          user={selectedUser}
          onClose={handleCloseUserDialog}
        />
      </div>
    </Layout>
  );
}