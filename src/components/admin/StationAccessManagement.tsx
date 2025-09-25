import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, Eye, EyeOff, Plus, Trash2, ToggleLeft, ToggleRight, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface StationCode {
  id: string;
  code: string;
  label: string | null;
  role: string;
  is_active: boolean;
  expires_at: string | null;
  allowed_paths: string[];
  created_at: string;
  last_used_at: string | null;
}

export function StationAccessManagement() {
  const [codes, setCodes] = useState<StationCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCodes, setShowCodes] = useState<Record<string, boolean>>({});
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<StationCode | null>(null);
  const { toast } = useToast();

  // Form state for creating new codes
  const [newCodeForm, setNewCodeForm] = useState({
    label: "",
    role: "station", 
    expires_at: "",
    allowed_paths: ["/station"],
    default_page: "/station"
  });

  // Form state for editing existing codes
  const [editCodeForm, setEditCodeForm] = useState({
    label: "",
    role: "station",
    expires_at: "",
    allowed_paths: ["/station"],
    default_page: "/station"
  });

  const availablePages = [
    { path: "/station", label: "Station Home" },
    { path: "/station/clock", label: "Time Clock" },
    { path: "/station/intake", label: "Quick Intake" },
    { path: "/station/inventory", label: "Inventory Check" },
    { path: "/station/staff", label: "Staff Tools" },
    { path: "/label-print", label: "Label Printing" }
  ];

  const loadCodes = async () => {
    try {
      const { data, error } = await supabase
        .from("station_login_codes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCodes(data || []);
    } catch (error) {
      console.error("Error loading codes:", error);
      toast({
        title: "Error",
        description: "Failed to load station access codes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCodes();
  }, []);

  const generateCode = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({
          title: "Not authenticated",
          description: "Please sign in as an admin to generate codes.",
          variant: "destructive",
        });
        return;
      }

      // Apply guardrails: ensure /station is included and default_page is in allowed_paths
      const normalizedPaths = Array.from(new Set([
        "/station", // Always include station home
        ...newCodeForm.allowed_paths.map(path => path.trim().toLowerCase()).filter(Boolean)
      ]));
      
      const defaultPage = newCodeForm.default_page.trim().toLowerCase();
      if (!normalizedPaths.includes(defaultPage)) {
        normalizedPaths.push(defaultPage);
      }

      const FN_BASE = "https://ffxvnhrqxkirdogknoid.supabase.co";
      const res = await fetch(`${FN_BASE}/functions/v1/station-login/generate-station-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          label: newCodeForm.label || null,
          role: newCodeForm.role,
          expires_at: newCodeForm.expires_at || null,
          allowed_paths: normalizedPaths,
          default_page: newCodeForm.default_page,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        console.error("Failed to generate code:", json);
        toast({
          title: "Error",
          description: json?.error || json?.reason || "Failed to generate access code",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Station access code generated successfully",
      });
      setIsCreateDialogOpen(false);
      setNewCodeForm({
        label: "",
        role: "station",
        expires_at: "",
        allowed_paths: ["/station"],
        default_page: "/station",
      });
      loadCodes();
    } catch (error: any) {
      console.error("Error generating code:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to generate access code",
        variant: "destructive",
      });
    }
  };

  const toggleCodeVisibility = (codeId: string) => {
    setShowCodes(prev => ({
      ...prev,
      [codeId]: !prev[codeId]
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Access code copied to clipboard",
    });
  };

  const toggleCodeStatus = async (codeId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("station_login_codes")
        .update({ is_active: !currentStatus })
        .eq("id", codeId);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: `Code ${!currentStatus ? 'activated' : 'deactivated'}`,
      });
      loadCodes();
    } catch (error) {
      console.error("Error toggling code status:", error);
      toast({
        title: "Error",
        description: "Failed to update code status",
        variant: "destructive",
      });
    }
  };

  const deleteCode = async (codeId: string) => {
    if (!confirm("Are you sure you want to delete this access code?")) return;

    try {
      const { error } = await supabase
        .from("station_login_codes")
        .delete()
        .eq("id", codeId);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Access code deleted",
      });
      loadCodes();
    } catch (error) {
      console.error("Error deleting code:", error);
      toast({
        title: "Error",
        description: "Failed to delete access code",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (code: StationCode) => {
    setEditingCode(code);
    setEditCodeForm({
      label: code.label || "",
      role: code.role,
      expires_at: code.expires_at ? new Date(code.expires_at).toISOString().slice(0, 16) : "",
      allowed_paths: code.allowed_paths,
      default_page: code.allowed_paths[0] || "/station"
    });
    setIsEditDialogOpen(true);
  };

  const updateCode = async () => {
    if (!editingCode) return;

    try {
      // Apply guardrails: ensure /station is included and default_page is in allowed_paths
      const normalizedPaths = Array.from(new Set([
        "/station", // Always include station home
        ...editCodeForm.allowed_paths.map(path => path.trim().toLowerCase()).filter(Boolean)
      ]));
      
      const defaultPage = editCodeForm.default_page.trim().toLowerCase();
      if (!normalizedPaths.includes(defaultPage)) {
        normalizedPaths.push(defaultPage);
      }

      const { error } = await supabase
        .from("station_login_codes")
        .update({
          label: editCodeForm.label || null,
          role: editCodeForm.role,
          expires_at: editCodeForm.expires_at || null,
          allowed_paths: normalizedPaths,
          default_page: editCodeForm.default_page
        })
        .eq("id", editingCode.id);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Access code updated successfully",
      });
      setIsEditDialogOpen(false);
      setEditingCode(null);
      setEditCodeForm({
        label: "",
        role: "station",
        expires_at: "",
        allowed_paths: ["/station"],
        default_page: "/station"
      });
      loadCodes();
    } catch (error) {
      console.error("Error updating code:", error);
      toast({
        title: "Error",
        description: "Failed to update access code",
        variant: "destructive",
      });
    }
  };

  const maskCode = (code: string) => {
    return "•".repeat(8) + code.slice(-4);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Station Access Codes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-pulse">Loading...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Station Access Codes</CardTitle>
          <p className="text-sm text-muted-foreground">
            Manage code-based access for station terminals
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Generate Code
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate New Access Code</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="label">Label (Optional)</Label>
                <Input
                  id="label"
                  value={newCodeForm.label}
                  onChange={(e) => setNewCodeForm(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="e.g., Receiving Desk iPad"
                />
              </div>
              
              <div>
                <Label htmlFor="role">Role</Label>
                <Select value={newCodeForm.role} onValueChange={(value) => 
                  setNewCodeForm(prev => ({ ...prev, role: value }))
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="station">Station</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="expires">Expiry Date (Optional)</Label>
                <Input
                  id="expires"
                  type="datetime-local"
                  value={newCodeForm.expires_at}
                  onChange={(e) => setNewCodeForm(prev => ({ ...prev, expires_at: e.target.value }))}
                />
              </div>

              <div>
                <Label>Allowed Pages</Label>
                <div className="space-y-2 mt-2">
                  {availablePages.map((page) => (
                    <div key={page.path} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={page.path}
                        checked={newCodeForm.allowed_paths.includes(page.path)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewCodeForm(prev => ({
                              ...prev,
                              allowed_paths: [...prev.allowed_paths, page.path]
                            }));
                          } else {
                            setNewCodeForm(prev => ({
                              ...prev,
                              allowed_paths: prev.allowed_paths.filter(p => p !== page.path)
                            }));
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor={page.path} className="text-sm">
                        {page.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="default_page">Default Page After Login</Label>
                <Select 
                  value={newCodeForm.default_page} 
                  onValueChange={(value) => setNewCodeForm(prev => ({ ...prev, default_page: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePages
                      .filter(page => newCodeForm.allowed_paths.includes(page.path))
                      .map((page) => (
                        <SelectItem key={page.path} value={page.path}>
                          {page.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <Alert>
                <AlertDescription>
                  A 12-character alphanumeric code will be automatically generated.
                  Select which pages this kiosk can access.
                </AlertDescription>
              </Alert>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={generateCode}>
                  Generate Code
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Access Code</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-label">Label (Optional)</Label>
                <Input
                  id="edit-label"
                  value={editCodeForm.label}
                  onChange={(e) => setEditCodeForm(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="e.g., Receiving Desk iPad"
                />
              </div>
              
              <div>
                <Label htmlFor="edit-role">Role</Label>
                <Select value={editCodeForm.role} onValueChange={(value) => 
                  setEditCodeForm(prev => ({ ...prev, role: value }))
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="station">Station</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-expires">Expiry Date (Optional)</Label>
                <Input
                  id="edit-expires"
                  type="datetime-local"
                  value={editCodeForm.expires_at}
                  onChange={(e) => setEditCodeForm(prev => ({ ...prev, expires_at: e.target.value }))}
                />
              </div>

              <div>
                <Label>Allowed Pages</Label>
                <div className="space-y-2 mt-2">
                  {availablePages.map((page) => (
                    <div key={page.path} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`edit-${page.path}`}
                        checked={editCodeForm.allowed_paths.includes(page.path)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditCodeForm(prev => ({
                              ...prev,
                              allowed_paths: [...prev.allowed_paths, page.path]
                            }));
                          } else {
                            setEditCodeForm(prev => ({
                              ...prev,
                              allowed_paths: prev.allowed_paths.filter(p => p !== page.path)
                            }));
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor={`edit-${page.path}`} className="text-sm">
                        {page.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="edit-default-page">Default Page After Login</Label>
                <Select 
                  value={editCodeForm.default_page} 
                  onValueChange={(value) => setEditCodeForm(prev => ({ ...prev, default_page: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePages
                      .filter(page => editCodeForm.allowed_paths.includes(page.path))
                      .map((page) => (
                        <SelectItem key={page.path} value={page.path}>
                          {page.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={updateCode}>
                  Update Code
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {codes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No station access codes created yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Allowed Pages</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {codes.map((code) => (
                <TableRow key={code.id}>
                  <TableCell>
                    {code.label || <span className="text-muted-foreground">No label</span>}
                  </TableCell>
                  <TableCell className="font-mono">
                    <div className="flex items-center gap-2">
                      <span>
                        {showCodes[code.id] ? code.code : maskCode(code.code)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleCodeVisibility(code.id)}
                      >
                        {showCodes[code.id] ? 
                          <EyeOff className="h-3 w-3" /> : 
                          <Eye className="h-3 w-3" />
                        }
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(code.code)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{code.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {code.allowed_paths.map((path) => (
                        <Badge key={path} variant="secondary" className="text-xs">
                          {availablePages.find(p => p.path === path)?.label || path}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={code.is_active ? "default" : "secondary"}>
                        {code.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleCodeStatus(code.id, code.is_active)}
                      >
                        {code.is_active ? 
                          <ToggleRight className="h-4 w-4 text-green-600" /> : 
                          <ToggleLeft className="h-4 w-4 text-gray-400" />
                        }
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    {code.last_used_at ? (
                      <span className="text-sm">
                        {format(new Date(code.last_used_at), 'MMM d, y h:mm a')}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Never</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {code.expires_at ? (
                      <span className="text-sm">
                        {format(new Date(code.expires_at), 'MMM d, y h:mm a')}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Never</span>
                    )}
                  </TableCell>
                   <TableCell>
                     <div className="flex items-center gap-1">
                       <Button
                         variant="ghost"
                         size="sm"
                         onClick={() => openEditDialog(code)}
                         className="text-muted-foreground hover:text-foreground"
                       >
                         <Edit className="h-4 w-4" />
                       </Button>
                       <Button
                         variant="ghost"
                         size="sm"
                         onClick={() => deleteCode(code.id)}
                         className="text-destructive hover:text-destructive"
                       >
                         <Trash2 className="h-4 w-4" />
                       </Button>
                     </div>
                   </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}