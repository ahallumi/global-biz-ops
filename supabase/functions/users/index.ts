import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateUserRequest {
  email: string;
  password: string;
  full_name: string;
  role?: 'admin' | 'staff';
  employee_id?: string; // Optional: link to existing employee
}

interface UpdateUserRequest {
  full_name?: string;
  role?: 'admin' | 'staff';
  employee_id?: string;
}

interface LinkUserEmployeeRequest {
  user_id: string;
  employee_id: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify admin authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: employee } = await supabaseClient
      .from('employees')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!employee || employee.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const method = req.method;

    if (method === 'GET') {
      return handleGetUsers(supabaseClient, url);
    } else if (method === 'POST') {
      const body = await req.json();
      if (url.pathname.endsWith('/link-employee')) {
        return handleLinkUserEmployee(supabaseClient, body);
      }
      return handleCreateUser(supabaseClient, body);
    } else if (method === 'PATCH') {
      const userId = url.pathname.split('/').pop();
      const body = await req.json();
      return handleUpdateUser(supabaseClient, userId!, body);
    } else if (method === 'DELETE') {
      const userId = url.pathname.split('/').pop();
      return handleDeleteUser(supabaseClient, userId!);
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in users function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleGetUsers(supabase: any, url: URL) {
  const searchParams = url.searchParams;
  const role = searchParams.get('role');
  const search = searchParams.get('search');

  // Get users from auth.users via admin API
  let query = supabase.auth.admin.listUsers();
  
  let { data: authUsers, error: authError } = await query;
  
  if (authError) {
    return new Response(
      JSON.stringify({ error: authError.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get employee data for users
  const { data: employees } = await supabase
    .from('employees')
    .select('*')
    .not('user_id', 'is', null);

  // Combine user and employee data
  const usersWithEmployees = authUsers.users.map((user: any) => {
    const employee = employees?.find((emp: any) => emp.user_id === user.id);
    return {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || user.email,
      role: employee?.role || 'staff',
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      employee_id: employee?.id,
      employee_name: employee ? `${employee.first_name} ${employee.last_name}` : null,
      online_access_enabled: !!employee?.online_access_enabled
    };
  });

  // Apply filters
  let filteredUsers = usersWithEmployees;
  
  if (role) {
    filteredUsers = filteredUsers.filter((user: any) => user.role === role);
  }
  
  if (search) {
    const searchLower = search.toLowerCase();
    filteredUsers = filteredUsers.filter((user: any) => 
      user.full_name?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.employee_name?.toLowerCase().includes(searchLower)
    );
  }

  return new Response(
    JSON.stringify(filteredUsers),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleCreateUser(supabase: any, data: CreateUserRequest) {
  const { email, password, full_name, role = 'staff', employee_id } = data;

  // Create user in auth
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: { full_name },
    email_confirm: true // Auto-confirm for admin-created users
  });

  if (authError) {
    return new Response(
      JSON.stringify({ error: authError.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // If linking to existing employee, update employee record
  if (employee_id) {
    const { error: linkError } = await supabase
      .from('employees')
      .update({ 
        user_id: authUser.user.id,
        online_access_enabled: true,
        role: role
      })
      .eq('id', employee_id);

    if (linkError) {
      // If linking fails, clean up the created user
      await supabase.auth.admin.deleteUser(authUser.user.id);
      return new Response(
        JSON.stringify({ error: 'Failed to link employee: ' + linkError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } else {
    // Create new employee record for the user
    const { error: employeeError } = await supabase
      .from('employees')
      .insert({
        user_id: authUser.user.id,
        full_name,
        first_name: full_name.split(' ')[0] || '',
        last_name: full_name.split(' ').slice(1).join(' ') || '',
        display_name: full_name,
        role: role,
        online_access_enabled: true,
        account_setup_completed: true,
        status: 'active'
      });

    if (employeeError) {
      // Clean up created user if employee creation fails
      await supabase.auth.admin.deleteUser(authUser.user.id);
      return new Response(
        JSON.stringify({ error: 'Failed to create employee record: ' + employeeError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  return new Response(
    JSON.stringify({ 
      id: authUser.user.id,
      email: authUser.user.email,
      full_name,
      role,
      employee_id
    }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleUpdateUser(supabase: any, userId: string, data: UpdateUserRequest) {
  const { full_name, role, employee_id } = data;

  // Update user metadata if full_name changed
  if (full_name) {
    const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { full_name }
    });

    if (authError) {
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Update employee record if role changed
  if (role) {
    const { error: roleError } = await supabase
      .from('employees')
      .update({ role })
      .eq('user_id', userId);

    if (roleError) {
      return new Response(
        JSON.stringify({ error: 'Failed to update role: ' + roleError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleLinkUserEmployee(supabase: any, data: LinkUserEmployeeRequest) {
  const { user_id, employee_id } = data;

  // Check if employee is already linked to another user
  const { data: existingEmployee } = await supabase
    .from('employees')
    .select('user_id')
    .eq('id', employee_id)
    .single();

  if (existingEmployee?.user_id && existingEmployee.user_id !== user_id) {
    return new Response(
      JSON.stringify({ error: 'Employee is already linked to another user account' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if user is already linked to another employee
  const { data: existingLink } = await supabase
    .from('employees')
    .select('id')
    .eq('user_id', user_id)
    .neq('id', employee_id);

  if (existingLink && existingLink.length > 0) {
    return new Response(
      JSON.stringify({ error: 'User is already linked to another employee' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Link the user to employee
  const { error } = await supabase
    .from('employees')
    .update({ 
      user_id,
      online_access_enabled: true,
      role: 'staff' // Default to staff when linking
    })
    .eq('id', employee_id);

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to link user to employee: ' + error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleDeleteUser(supabase: any, userId: string) {
  // First unlink from employee if linked
  await supabase
    .from('employees')
    .update({ 
      user_id: null,
      online_access_enabled: false
    })
    .eq('user_id', userId);

  // Delete user from auth
  const { error } = await supabase.auth.admin.deleteUser(userId);

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}