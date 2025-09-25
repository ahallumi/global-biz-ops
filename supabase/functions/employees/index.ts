import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

interface CreateEmployeeRequest {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  position?: string;
  department?: string;
  hire_date?: string;
  pay_type: 'hourly' | 'salary';
  hourly_rate?: number;
  salary_annual?: number;
  pin_raw?: string; // Only on create/update, will be hashed
}

interface UpdateEmployeeRequest extends Partial<CreateEmployeeRequest> {
  status?: 'active' | 'inactive';
}

// Helper function to hash PIN using Web Crypto API
async function hashPin(pin: string): Promise<{ salt: string; hash: string }> {
  const salt = crypto.randomUUID();
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  const hashBase64 = btoa(String.fromCharCode(...hashArray))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  return { salt, hash: hashBase64 };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Verify admin auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (empError || employee?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const employeeId = url.pathname.split('/').pop();

    switch (req.method) {
      case 'GET':
        return await handleGetEmployees(supabase, url.searchParams);
      
      case 'POST':
        const createData: CreateEmployeeRequest = await req.json();
        return await handleCreateEmployee(supabase, createData);
      
      case 'PATCH':
        if (!employeeId || employeeId === 'employees') {
          return new Response(
            JSON.stringify({ error: "Employee ID required for update" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const updateData: UpdateEmployeeRequest = await req.json();
        return await handleUpdateEmployee(supabase, employeeId, updateData);
      
      case 'DELETE':
        if (!employeeId || employeeId === 'employees') {
          return new Response(
            JSON.stringify({ error: "Employee ID required for delete" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return await handleDeleteEmployee(supabase, employeeId);
      
      default:
        return new Response(
          JSON.stringify({ error: "Method not allowed" }),
          { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error('Employee management error:', error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleGetEmployees(supabase: any, params: URLSearchParams) {
  const status = params.get('status');
  const department = params.get('department');
  const search = params.get('search');
  
  let query = supabase
    .from('employees')
    .select(`
      id, first_name, last_name, display_name, email, phone, 
      position, department, status, hire_date, pay_type, 
      hourly_rate_cents, salary_annual, created_at
    `)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }
  
  if (department) {
    query = query.eq('department', department);
  }
  
  if (search) {
    query = query.or(`first_name.ilike.%${search}%, last_name.ilike.%${search}%, email.ilike.%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Convert hourly_rate_cents to dollars for response
  const employees = data.map((emp: any) => ({
    ...emp,
    hourly_rate: emp.hourly_rate_cents ? emp.hourly_rate_cents / 100 : null
  }));

  return new Response(
    JSON.stringify({ employees }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleCreateEmployee(supabase: any, data: CreateEmployeeRequest) {
  console.log('Creating employee with data:', { ...data, pin_raw: data.pin_raw ? '[REDACTED]' : undefined });
  
  const { pin_raw, hourly_rate, ...employeeData } = data;
  
  // Hash PIN if provided
  let pin_salt = null;
  let pin_hash = null;
  if (pin_raw) {
    const pinData = await hashPin(pin_raw);
    pin_salt = pinData.salt;
    pin_hash = pinData.hash;
  }

  // Convert hourly rate to cents
  const hourly_rate_cents = hourly_rate ? Math.round(hourly_rate * 100) : null;
  
  // Set required fields that were missing
  const full_name = `${data.first_name} ${data.last_name}`.trim();
  const display_name = full_name; // Use full name as display name by default
  
  const insertData = {
    ...employeeData,
    full_name,
    display_name,
    hourly_rate_cents,
    pin_salt,
    pin_hash,
    status: 'active',
    online_access_enabled: false, // New employees don't have online access initially
    account_setup_completed: false,
    user_id: null // No user account initially
  };
  
  console.log('Inserting employee data:', { ...insertData, pin_salt: insertData.pin_salt ? '[REDACTED]' : undefined, pin_hash: insertData.pin_hash ? '[REDACTED]' : undefined });

  const { data: employee, error } = await supabase
    .from('employees')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('Employee creation failed:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.details,
        hint: error.hint
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Remove sensitive data from response
  const { pin_salt: _, pin_hash: __, ...safeEmployee } = employee;
  
  return new Response(
    JSON.stringify({ 
      employee: {
        ...safeEmployee,
        hourly_rate: safeEmployee.hourly_rate_cents ? safeEmployee.hourly_rate_cents / 100 : null
      }
    }),
    { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleUpdateEmployee(supabase: any, employeeId: string, data: UpdateEmployeeRequest) {
  const { pin_raw, hourly_rate, ...employeeData } = data;
  
  let updateData = { ...employeeData };
  
  // Hash PIN if provided
  if (pin_raw) {
    const pinData = await hashPin(pin_raw);
    (updateData as any).pin_salt = pinData.salt;
    (updateData as any).pin_hash = pinData.hash;
  }

  // Convert hourly rate to cents
  if (hourly_rate !== undefined) {
    (updateData as any).hourly_rate_cents = hourly_rate ? Math.round(hourly_rate * 100) : null;
  }

  const { data: employee, error } = await supabase
    .from('employees')
    .update(updateData)
    .eq('id', employeeId)
    .select()
    .single();

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Remove sensitive data from response
  const { pin_salt: _, pin_hash: __, ...safeEmployee } = employee;
  
  return new Response(
    JSON.stringify({ 
      employee: {
        ...safeEmployee,
        hourly_rate: safeEmployee.hourly_rate_cents ? safeEmployee.hourly_rate_cents / 100 : null
      }
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleDeleteEmployee(supabase: any, employeeId: string) {
  // Soft delete by setting status to inactive
  const { data: employee, error } = await supabase
    .from('employees')
    .update({ status: 'inactive' })
    .eq('id', employeeId)
    .select()
    .single();

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ message: "Employee deactivated successfully" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}