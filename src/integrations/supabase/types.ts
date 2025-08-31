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
      intake_reconcile: {
        Row: {
          created_at: string | null
          expected_cost_cents: number | null
          expected_qty: number | null
          id: string
          intake_id: string
          intake_item_id: string | null
          invoice_line_id: string | null
          note: string | null
          product_id: string | null
          received_cost_cents: number | null
          received_qty: number | null
          status: Database["public"]["Enums"]["intake_resolve"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          expected_cost_cents?: number | null
          expected_qty?: number | null
          id?: string
          intake_id: string
          intake_item_id?: string | null
          invoice_line_id?: string | null
          note?: string | null
          product_id?: string | null
          received_cost_cents?: number | null
          received_qty?: number | null
          status?: Database["public"]["Enums"]["intake_resolve"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          expected_cost_cents?: number | null
          expected_qty?: number | null
          id?: string
          intake_id?: string
          intake_item_id?: string | null
          invoice_line_id?: string | null
          note?: string | null
          product_id?: string | null
          received_cost_cents?: number | null
          received_qty?: number | null
          status?: Database["public"]["Enums"]["intake_resolve"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intake_reconcile_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "product_intakes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_reconcile_intake_item_id_fkey"
            columns: ["intake_item_id"]
            isOneToOne: false
            referencedRelation: "product_intake_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_reconcile_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_reconcile_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_credentials: {
        Row: {
          created_at: string | null
          id: string
          integration_id: string
          secret_ciphertext: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          integration_id: string
          secret_ciphertext: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          integration_id?: string
          secret_ciphertext?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_credentials_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: true
            referencedRelation: "inventory_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_integrations: {
        Row: {
          auto_import_enabled: boolean
          auto_import_interval_minutes: number
          auto_push_enabled: boolean
          created_at: string | null
          created_by: string | null
          display_name: string | null
          environment: string
          id: string
          last_error: string | null
          last_success_at: string | null
          provider: Database["public"]["Enums"]["pos_source"]
          updated_at: string | null
        }
        Insert: {
          auto_import_enabled?: boolean
          auto_import_interval_minutes?: number
          auto_push_enabled?: boolean
          created_at?: string | null
          created_by?: string | null
          display_name?: string | null
          environment?: string
          id?: string
          last_error?: string | null
          last_success_at?: string | null
          provider?: Database["public"]["Enums"]["pos_source"]
          updated_at?: string | null
        }
        Update: {
          auto_import_enabled?: boolean
          auto_import_interval_minutes?: number
          auto_push_enabled?: boolean
          created_at?: string | null
          created_by?: string | null
          display_name?: string | null
          environment?: string
          id?: string
          last_error?: string | null
          last_success_at?: string | null
          provider?: Database["public"]["Enums"]["pos_source"]
          updated_at?: string | null
        }
        Relationships: []
      }
      product_candidates: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          intake_id: string | null
          merged_into_product_id: string | null
          name: string | null
          notes: string | null
          plu: string | null
          size: string | null
          source: string
          status: string
          suggested_cost_cents: number | null
          suggested_units_per_case: number | null
          supplier_id: string | null
          unit_of_sale: Database["public"]["Enums"]["unit_of_sale"] | null
          upc: string | null
          updated_at: string | null
          weight_unit: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          intake_id?: string | null
          merged_into_product_id?: string | null
          name?: string | null
          notes?: string | null
          plu?: string | null
          size?: string | null
          source?: string
          status?: string
          suggested_cost_cents?: number | null
          suggested_units_per_case?: number | null
          supplier_id?: string | null
          unit_of_sale?: Database["public"]["Enums"]["unit_of_sale"] | null
          upc?: string | null
          updated_at?: string | null
          weight_unit?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          intake_id?: string | null
          merged_into_product_id?: string | null
          name?: string | null
          notes?: string | null
          plu?: string | null
          size?: string | null
          source?: string
          status?: string
          suggested_cost_cents?: number | null
          suggested_units_per_case?: number | null
          supplier_id?: string | null
          unit_of_sale?: Database["public"]["Enums"]["unit_of_sale"] | null
          upc?: string | null
          updated_at?: string | null
          weight_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_candidates_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "product_intakes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_candidates_merged_into_product_id_fkey"
            columns: ["merged_into_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_candidates_merged_into_product_id_fkey"
            columns: ["merged_into_product_id"]
            isOneToOne: false
            referencedRelation: "v_products_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_candidates_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_import_runs: {
        Row: {
          created_by: string | null
          created_count: number | null
          cursor: string | null
          errors: Json | null
          finished_at: string | null
          id: string
          integration_id: string
          last_progress_at: string
          processed_count: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["import_status"]
          updated_count: number | null
        }
        Insert: {
          created_by?: string | null
          created_count?: number | null
          cursor?: string | null
          errors?: Json | null
          finished_at?: string | null
          id?: string
          integration_id: string
          last_progress_at?: string
          processed_count?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          updated_count?: number | null
        }
        Update: {
          created_by?: string | null
          created_count?: number | null
          cursor?: string | null
          errors?: Json | null
          finished_at?: string | null
          id?: string
          integration_id?: string
          last_progress_at?: string
          processed_count?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          updated_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_import_runs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "inventory_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_intake_items: {
        Row: {
          candidate_id: string | null
          created_at: string | null
          description: string | null
          expiry_date: string | null
          id: string
          intake_id: string
          line_total_cents: number | null
          lot_number: string | null
          photo_url: string | null
          product_id: string | null
          quantity: number
          quantity_boxes: number
          unit_cost_cents: number
          units_per_box: number
          upc: string | null
          updated_at: string | null
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string | null
          description?: string | null
          expiry_date?: string | null
          id?: string
          intake_id: string
          line_total_cents?: number | null
          lot_number?: string | null
          photo_url?: string | null
          product_id?: string | null
          quantity?: number
          quantity_boxes: number
          unit_cost_cents?: number
          units_per_box: number
          upc?: string | null
          updated_at?: string | null
        }
        Update: {
          candidate_id?: string | null
          created_at?: string | null
          description?: string | null
          expiry_date?: string | null
          id?: string
          intake_id?: string
          line_total_cents?: number | null
          lot_number?: string | null
          photo_url?: string | null
          product_id?: string | null
          quantity?: number
          quantity_boxes?: number
          unit_cost_cents?: number
          units_per_box?: number
          upc?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_intake_items_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "product_candidates"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "product_intake_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products_catalog"
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
      product_pos_links: {
        Row: {
          created_at: string | null
          id: string
          location_id: string | null
          pos_item_id: string
          pos_variation_id: string | null
          product_id: string
          source: Database["public"]["Enums"]["pos_source"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          location_id?: string | null
          pos_item_id: string
          pos_variation_id?: string | null
          product_id: string
          source?: Database["public"]["Enums"]["pos_source"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          location_id?: string | null
          pos_item_id?: string
          pos_variation_id?: string | null
          product_id?: string
          source?: Database["public"]["Enums"]["pos_source"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_pos_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pos_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sync_runs: {
        Row: {
          created_by: string | null
          created_count: number | null
          direction: string
          errors: Json | null
          finished_at: string | null
          id: string
          processed_count: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["import_status"]
          updated_count: number | null
        }
        Insert: {
          created_by?: string | null
          created_count?: number | null
          direction?: string
          errors?: Json | null
          finished_at?: string | null
          id?: string
          processed_count?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          updated_count?: number | null
        }
        Update: {
          created_by?: string | null
          created_count?: number | null
          direction?: string
          errors?: Json | null
          finished_at?: string | null
          id?: string
          processed_count?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          updated_count?: number | null
        }
        Relationships: []
      }
      products: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          approved_candidate_id: string | null
          barcode: string | null
          brand: string | null
          catalog_status: Database["public"]["Enums"]["catalog_status"]
          category: string | null
          created_at: string | null
          default_cost_cents: number | null
          id: string
          image_url: string | null
          name: string
          origin: string
          plu: string | null
          retail_price_cents: number | null
          size: string | null
          sku: string | null
          sync_state: string
          unit_of_sale: Database["public"]["Enums"]["unit_of_sale"]
          upc: string | null
          updated_at: string | null
          weight_unit: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          approved_candidate_id?: string | null
          barcode?: string | null
          brand?: string | null
          catalog_status?: Database["public"]["Enums"]["catalog_status"]
          category?: string | null
          created_at?: string | null
          default_cost_cents?: number | null
          id?: string
          image_url?: string | null
          name: string
          origin?: string
          plu?: string | null
          retail_price_cents?: number | null
          size?: string | null
          sku?: string | null
          sync_state?: string
          unit_of_sale?: Database["public"]["Enums"]["unit_of_sale"]
          upc?: string | null
          updated_at?: string | null
          weight_unit?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          approved_candidate_id?: string | null
          barcode?: string | null
          brand?: string | null
          catalog_status?: Database["public"]["Enums"]["catalog_status"]
          category?: string | null
          created_at?: string | null
          default_cost_cents?: number | null
          id?: string
          image_url?: string | null
          name?: string
          origin?: string
          plu?: string | null
          retail_price_cents?: number | null
          size?: string | null
          sku?: string | null
          sync_state?: string
          unit_of_sale?: Database["public"]["Enums"]["unit_of_sale"]
          upc?: string | null
          updated_at?: string | null
          weight_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_approved_candidate_id_fkey"
            columns: ["approved_candidate_id"]
            isOneToOne: false
            referencedRelation: "product_candidates"
            referencedColumns: ["id"]
          },
        ]
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
      supplier_products: {
        Row: {
          created_at: string | null
          id: string
          last_cost_cents: number | null
          last_received_at: string | null
          product_id: string
          supplier_id: string
          units_per_case: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_cost_cents?: number | null
          last_received_at?: string | null
          product_id: string
          supplier_id: string
          units_per_case?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_cost_cents?: number | null
          last_received_at?: string | null
          product_id?: string
          supplier_id?: string
          units_per_case?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
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
      v_products_catalog: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          approved_candidate_id: string | null
          barcode: string | null
          brand: string | null
          catalog_status: Database["public"]["Enums"]["catalog_status"] | null
          category: string | null
          created_at: string | null
          default_cost_cents: number | null
          id: string | null
          image_url: string | null
          name: string | null
          origin: string | null
          plu: string | null
          retail_price_cents: number | null
          size: string | null
          sku: string | null
          sync_state: string | null
          unit_of_sale: Database["public"]["Enums"]["unit_of_sale"] | null
          upc: string | null
          updated_at: string | null
          weight_unit: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          approved_candidate_id?: string | null
          barcode?: string | null
          brand?: string | null
          catalog_status?: Database["public"]["Enums"]["catalog_status"] | null
          category?: string | null
          created_at?: string | null
          default_cost_cents?: number | null
          id?: string | null
          image_url?: string | null
          name?: string | null
          origin?: string | null
          plu?: string | null
          retail_price_cents?: number | null
          size?: string | null
          sku?: string | null
          sync_state?: string | null
          unit_of_sale?: Database["public"]["Enums"]["unit_of_sale"] | null
          upc?: string | null
          updated_at?: string | null
          weight_unit?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          approved_candidate_id?: string | null
          barcode?: string | null
          brand?: string | null
          catalog_status?: Database["public"]["Enums"]["catalog_status"] | null
          category?: string | null
          created_at?: string | null
          default_cost_cents?: number | null
          id?: string | null
          image_url?: string | null
          name?: string | null
          origin?: string | null
          plu?: string | null
          retail_price_cents?: number | null
          size?: string | null
          sku?: string | null
          sync_state?: string | null
          unit_of_sale?: Database["public"]["Enums"]["unit_of_sale"] | null
          upc?: string | null
          updated_at?: string | null
          weight_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_approved_candidate_id_fkey"
            columns: ["approved_candidate_id"]
            isOneToOne: false
            referencedRelation: "product_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
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
      decrypt_secret: {
        Args: { cipher_b64: string; p_crypt_key: string }
        Returns: string
      }
      get_decrypted_credentials: {
        Args: { p_crypt_key: string; p_integration_id: string }
        Returns: {
          access_token: string
          environment: string
        }[]
      }
      has_role: {
        Args: {
          p_roles: Database["public"]["Enums"]["employee_role"][]
          p_uid: string
        }
        Returns: boolean
      }
      import_mark_stale: {
        Args:
          | {
              partial_minutes?: number
              pending_minutes?: number
              running_minutes?: number
            }
          | { pending_minutes?: number; running_minutes?: number }
        Returns: {
          error_msg: string
          new_status: string
          old_status: string
          run_id: string
        }[]
      }
      is_admin: {
        Args: { p_uid: string }
        Returns: boolean
      }
      save_encrypted_credentials: {
        Args: {
          p_access_token: string
          p_crypt_key: string
          p_integration_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      catalog_status: "ACTIVE" | "PLACEHOLDER" | "ARCHIVED"
      employee_role: "admin" | "staff" | "manager"
      import_status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "PARTIAL"
      intake_resolve:
        | "OK"
        | "QTY_MISMATCH"
        | "PRICE_MISMATCH"
        | "NEW_PRODUCT"
        | "MISSING"
      intake_status:
        | "draft"
        | "submitted"
        | "approved"
        | "rejected"
        | "needs_correction"
      pos_source: "SQUARE"
      unit_of_sale: "EACH" | "WEIGHT"
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
      catalog_status: ["ACTIVE", "PLACEHOLDER", "ARCHIVED"],
      employee_role: ["admin", "staff", "manager"],
      import_status: ["PENDING", "RUNNING", "SUCCESS", "FAILED", "PARTIAL"],
      intake_resolve: [
        "OK",
        "QTY_MISMATCH",
        "PRICE_MISMATCH",
        "NEW_PRODUCT",
        "MISSING",
      ],
      intake_status: [
        "draft",
        "submitted",
        "approved",
        "rejected",
        "needs_correction",
      ],
      pos_source: ["SQUARE"],
      unit_of_sale: ["EACH", "WEIGHT"],
    },
  },
} as const
