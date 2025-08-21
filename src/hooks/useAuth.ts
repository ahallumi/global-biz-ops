import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface Employee {
  id: string;
  user_id: string;
  full_name: string;
  role: 'admin' | 'staff' | 'manager';
  hourly_rate?: number;
  created_at: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [actingAsStaff, setActingAsStaff] = useState(() => {
    try {
      return localStorage.getItem('gf:acting_as_staff') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer fetching employee data to avoid recursion
          setTimeout(() => {
            fetchEmployeeData(session.user.id);
          }, 0);
        } else {
          setEmployee(null);
        }
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchEmployeeData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchEmployeeData = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching employee data:', error);
        return;
      }

      setEmployee(data);
    } catch (error) {
      console.error('Error in fetchEmployeeData:', error);
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            full_name: fullName
          }
        }
      });

      if (error) {
        toast({
          title: "Sign Up Failed",
          description: error.message,
          variant: "destructive"
        });
        return { error };
      }

      if (data?.user && !data.session) {
        toast({
          title: "Check your email",
          description: "Please check your email for a confirmation link.",
        });
      }

      return { data };
    } catch (error: any) {
      toast({
        title: "Sign Up Failed",
        description: error.message,
        variant: "destructive"
      });
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        toast({
          title: "Sign In Failed",
          description: error.message,
          variant: "destructive"
        });
        return { error };
      }

      // Fetch employee data immediately after successful login
      if (data?.user) {
        const { data: employeeData } = await supabase
          .from('employees')
          .select('*')
          .eq('user_id', data.user.id)
          .single();

        toast({
          title: "Welcome back!",
          description: "You have successfully signed in.",
        });

        return { data, employee: employeeData };
      }

      return { data };
    } catch (error: any) {
      toast({
        title: "Sign In Failed",
        description: error.message,
        variant: "destructive"
      });
      return { error };
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Sign Out Failed",
        description: error.message,
        variant: "destructive"
      });
    } else {
      // Clear staff mode on sign out
      setActingAsStaff(false);
      try {
        localStorage.removeItem('gf:acting_as_staff');
      } catch {}
      toast({
        title: "Signed out successfully",
        description: "You have been signed out.",
      });
    }
  };

  const enterStaffMode = () => {
    setActingAsStaff(true);
    try {
      localStorage.setItem('gf:acting_as_staff', '1');
    } catch {}
  };

  const exitStaffMode = () => {
    setActingAsStaff(false);
    try {
      localStorage.removeItem('gf:acting_as_staff');
    } catch {}
  };

  const isAdmin = () => employee?.role === 'admin';
  const isStaff = () => employee?.role === 'staff';
  const isManager = () => employee?.role === 'manager';

  return {
    user,
    session,
    employee,
    loading,
    actingAsStaff,
    signUp,
    signIn,
    signOut,
    enterStaffMode,
    exitStaffMode,
    isAdmin,
    isStaff,
    isManager
  };
}