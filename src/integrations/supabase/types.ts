export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      employees: {
        Row: {
          active: boolean | null
          avatar_url: string | null
          created_at: string | null
          full_name: string
          hourly_rate: number | null
          hourly_rate_cents: number | null
          id: string
          role: Database["public"]["Enums"]["employee_role"]
          staff_code: string | null
          staff_pin: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          full_name: string
          hourly_rate?: number | null
          hourly_rate_cents?: number | null
          id?: string
          role?: Database["public"]["Enums"]["employee_role"]
          staff_code?: string | null
          staff_pin?: string | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string
          hourly_rate?: number | null
          hourly_rate_cents?: number | null
          id?: string
          role?: Database["public"]["Enums"]["employee_role"]
          staff_code?: string | null
          staff_pin?: string | null
          user_id?: string
        }
        Relationships: []
      }
      intake_files: {
        Row: {
          byte_size: number | null
          created_at: string | null
          id: string
          intake_id: string
          kind: string
          mime_type: string | null
          url: string
        }
        Insert: {
          byte_size?: number | null
          created_at?: string | null
          id?: string
          intake_id: string
          kind: string
          mime_type?: string | null
          url: string
        }
        Update: {
          byte_size?: number | null
          created_at?: string | null
          id?: string
          intake_id?: string
          kind?: string
          mime_type?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_files_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "product_intakes"
            referencedColumns: ["id"]
          },
        ]
      }
      product_intake_items: {
        Row: {
          created_at: string | null
          description: string | null
          expiry_date: string | null
          id: string
          intake_id: string
          line_total_cents: number | null
          lot_number: string | null
          photo_url: string | null
          product_id: string
          quantity: number
          quantity_boxes: number
          unit_cost_cents: number
          units_per_box: number
          upc: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          expiry_date?: string | null
          id?: string
          intake_id: string
          line_total_cents?: number | null
          lot_number?: string | null
          photo_url?: string | null
          product_id: string
          quantity?: number
          quantity_boxes: number
          unit_cost_cents?: number
          units_per_box: number
          upc?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          expiry_date?: string | null
          id?: string
          intake_id?: string
          line_total_cents?: number | null
          lot_number?: string | null
          photo_url?: string | null
          product_id?: string
          quantity?: number
          quantity_boxes?: number
          unit_cost_cents?: number
          units_per_box?: number
          upc?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_intake_items_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "product_intakes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_intake_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_intakes: {
        Row: {
          created_at: string | null
          date_received: string
          id: string
          invoice_number: string | null
          invoice_url: string | null
          location_id: string | null
          notes: string | null
          status: Database["public"]["Enums"]["intake_status"]
          submitted_by: string
          supplier_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date_received?: string
          id?: string
          invoice_number?: string | null
          invoice_url?: string | null
          location_id?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["intake_status"]
          submitted_by: string
          supplier_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date_received?: string
          id?: string
          invoice_number?: string | null
          invoice_url?: string | null
          location_id?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["intake_status"]
          submitted_by?: string
          supplier_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_intakes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          category: string | null
          created_at: string | null
          default_cost_cents: number | null
          id: string
          image_url: string | null
          name: string
          size: string | null
          sku: string | null
          upc: string | null
          updated_at: string | null
        }
        Insert: {
          barcode?: string | null
          category?: string | null
          created_at?: string | null
          default_cost_cents?: number | null
          id?: string
          image_url?: string | null
          name: string
          size?: string | null
          sku?: string | null
          upc?: string | null
          updated_at?: string | null
        }
        Update: {
          barcode?: string | null
          category?: string | null
          created_at?: string | null
          default_cost_cents?: number | null
          id?: string
          image_url?: string | null
          name?: string
          size?: string | null
          sku?: string | null
          upc?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      punch_events: {
        Row: {
          created_at: string | null
          created_by: string | null
          employee_id: string
          event_at: string
          id: string
          ip: string | null
          kind: string
          note: string | null
          shift_id: string | null
          source: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          employee_id: string
          event_at?: string
          id?: string
          ip?: string | null
          kind: string
          note?: string | null
          shift_id?: string | null
          source?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          employee_id?: string
          event_at?: string
          id?: string
          ip?: string | null
          kind?: string
          note?: string | null
          shift_id?: string | null
          source?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "punch_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["user_id"]
          },
        ]
      }
      shift_breaks: {
        Row: {
          created_at: string | null
          end_at: string | null
          id: string
          kind: string
          shift_id: string
          start_at: string
        }
        Insert: {
          created_at?: string | null
          end_at?: string | null
          id?: string
          kind?: string
          shift_id: string
          start_at: string
        }
        Update: {
          created_at?: string | null
          end_at?: string | null
          id?: string
          kind?: string
          shift_id?: string
          start_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_breaks_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          break_open_at: string | null
          break_seconds: number
          clock_in_at: string
          clock_out_at: string | null
          created_at: string | null
          employee_id: string
          id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          break_open_at?: string | null
          break_seconds?: number
          clock_in_at: string
          clock_out_at?: string | null
          created_at?: string | null
          employee_id: string
          id?: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          break_open_at?: string | null
          break_seconds?: number
          clock_in_at?: string
          clock_out_at?: string | null
          created_at?: string | null
          employee_id?: string
          id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["user_id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          address_line1: string | null
          address_line2: string | null
          city: string | null
          code: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string | null
          created_at: string | null
          id: string
          name: string
          postal_code: string | null
          state: string | null
          terms: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          code: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          name: string
          postal_code?: string | null
          state?: string | null
          terms?: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          code?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          name?: string
          postal_code?: string | null
          state?: string | null
          terms?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      time_settings: {
        Row: {
          auto_clock_out_hours: number
          default_break_kind: string
          id: number
          overtime_daily_hours: number
          overtime_weekly_hours: number
          rounding_minutes: number
          timezone: string
        }
        Insert: {
          auto_clock_out_hours?: number
          default_break_kind?: string
          id?: number
          overtime_daily_hours?: number
          overtime_weekly_hours?: number
          rounding_minutes?: number
          timezone?: string
        }
        Update: {
          auto_clock_out_hours?: number
          default_break_kind?: string
          id?: number
          overtime_daily_hours?: number
          overtime_weekly_hours?: number
          rounding_minutes?: number
          timezone?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_timesheet_daily: {
        Row: {
          break_seconds: number | null
          day_ct: string | null
          employee_id: string | null
          first_in: string | null
          last_out: string | null
          net_seconds: number | null
          shifts_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Functions: {
      ct_date: {
        Args: { ts: string }
        Returns: string
      }
      has_role: {
        Args: {
          p_roles: Database["public"]["Enums"]["employee_role"][]
          p_uid: string
        }
        Returns: boolean
      }
      is_admin: {
        Args: { p_uid: string }
        Returns: boolean
      }
    }
    Enums: {
      employee_role: "admin" | "staff" | "manager"
      intake_status:
        | "draft"
        | "submitted"
        | "approved"
        | "rejected"
        | "needs_correction"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      employee_role: ["admin", "staff", "manager"],
      intake_status: [
        "draft",
        "submitted",
        "approved",
        "rejected",
        "needs_correction",
      ],
    },
  },
} as const
