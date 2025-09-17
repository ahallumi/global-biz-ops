export interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  email?: string;
  phone?: string;
  position?: string;
  department?: string;
  status: 'active' | 'inactive';
  hire_date?: string;
  pay_type: 'hourly' | 'salary';
  hourly_rate?: number;
  salary_annual?: number;
  created_at: string;
  online_access_enabled: boolean;
  account_setup_completed: boolean;
  invited_at?: string;
  setup_token?: string;
  setup_token_expires?: string;
  role: 'admin' | 'staff' | 'manager';
}

export interface CreateEmployeeRequest {
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
  pin_raw?: string;
}

export interface UpdateEmployeeRequest extends Partial<CreateEmployeeRequest> {
  status?: 'active' | 'inactive';
  online_access_enabled?: boolean;
  role?: 'admin' | 'staff' | 'manager';
}

export interface PayrollEntry {
  date: string;
  clock_in: string;
  clock_out?: string;
  hours: number;
  overtime_hours: number;
  break_minutes: number;
}

export interface PayrollResult {
  employee_id: string;
  employee_name: string;
  regular_hours: number;
  overtime_hours: number;
  doubletime_hours: number;
  total_break_minutes: number;
  hourly_rate: number;
  gross_regular: number;
  gross_overtime: number;
  gross_total: number;
  entries: PayrollEntry[];
}

export interface PayrollCalcRequest {
  employee_id?: string;
  start_date: string;
  end_date: string;
  rounding_minutes?: number;
  timezone?: string;
}