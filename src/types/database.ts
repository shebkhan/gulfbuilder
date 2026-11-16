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
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accounting_periods: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          month: string
          org_id: string
          status: Database["public"]["Enums"]["period_status"]
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          month: string
          org_id: string
          status?: Database["public"]["Enums"]["period_status"]
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          month?: string
          org_id?: string
          status?: Database["public"]["Enums"]["period_status"]
        }
        Relationships: [
          {
            foreignKeyName: "accounting_periods_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          code: string
          created_at: string
          id: string
          is_system: boolean
          name: string
          org_id: string
          parent_id: string | null
          type: Database["public"]["Enums"]["account_type"]
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_system?: boolean
          name: string
          org_id: string
          parent_id?: string | null
          type: Database["public"]["Enums"]["account_type"]
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_system?: boolean
          name?: string
          org_id?: string
          parent_id?: string | null
          type?: Database["public"]["Enums"]["account_type"]
        }
        Relationships: [
          {
            foreignKeyName: "accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          at: string
          id: number
          new_data: Json | null
          old_data: Json | null
          org_id: string | null
          row_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          org_id?: string | null
          row_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          org_id?: string | null
          row_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_no: string | null
          bank_name: string | null
          created_at: string
          currency: string
          id: string
          is_default: boolean
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          account_no?: string | null
          bank_name?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_default?: boolean
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          account_no?: string | null
          bank_name?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_default?: boolean
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      buildings: {
        Row: {
          amenities: string[]
          building_no: string | null
          city: string | null
          code: string
          country_code: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          national_address: Json | null
          notes: string | null
          org_id: string
          owner_id: string
          property_value_minor: number | null
          street: string | null
          updated_at: string
          zone: string | null
        }
        Insert: {
          amenities?: string[]
          building_no?: string | null
          city?: string | null
          code: string
          country_code: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          national_address?: Json | null
          notes?: string | null
          org_id: string
          owner_id: string
          property_value_minor?: number | null
          street?: string | null
          updated_at?: string
          zone?: string | null
        }
        Update: {
          amenities?: string[]
          building_no?: string | null
          city?: string | null
          code?: string
          country_code?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          national_address?: Json | null
          notes?: string | null
          org_id?: string
          owner_id?: string
          property_value_minor?: number | null
          street?: string | null
          updated_at?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buildings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buildings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      charges: {
        Row: {
          amount_minor: number
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          due_date: string
          id: string
          lease_id: string
          org_id: string
          paid_minor: number
          period_end: string | null
          period_start: string | null
          status: Database["public"]["Enums"]["charge_status"]
          type: Database["public"]["Enums"]["charge_type"]
          updated_at: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          created_by?: string | null
          currency: string
          description?: string | null
          due_date: string
          id?: string
          lease_id: string
          org_id: string
          paid_minor?: number
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["charge_status"]
          type: Database["public"]["Enums"]["charge_type"]
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          due_date?: string
          id?: string
          lease_id?: string
          org_id?: string
          paid_minor?: number
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["charge_status"]
          type?: Database["public"]["Enums"]["charge_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "charges_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "charges_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cheques: {
        Row: {
          amount_minor: number
          bank_account_id: string | null
          bank_name: string | null
          bounce_reason: string | null
          cheque_date: string
          cheque_no: string
          cleared_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          deposited_at: string | null
          id: string
          lease_id: string | null
          notes: string | null
          org_id: string
          payment_id: string | null
          replaced_by: string | null
          status: Database["public"]["Enums"]["cheque_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_minor: number
          bank_account_id?: string | null
          bank_name?: string | null
          bounce_reason?: string | null
          cheque_date: string
          cheque_no: string
          cleared_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deposited_at?: string | null
          id?: string
          lease_id?: string | null
          notes?: string | null
          org_id: string
          payment_id?: string | null
          replaced_by?: string | null
          status?: Database["public"]["Enums"]["cheque_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          bank_account_id?: string | null
          bank_name?: string | null
          bounce_reason?: string | null
          cheque_date?: string
          cheque_no?: string
          cleared_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deposited_at?: string | null
          id?: string
          lease_id?: string | null
          notes?: string | null
          org_id?: string
          payment_id?: string | null
          replaced_by?: string | null
          status?: Database["public"]["Enums"]["cheque_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cheques_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheques_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheques_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheques_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheques_replaced_by_fkey"
            columns: ["replaced_by"]
            isOneToOne: false
            referencedRelation: "cheques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheques_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheques_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          exponent: number
          name: string
        }
        Insert: {
          code: string
          exponent: number
          name: string
        }
        Update: {
          code?: string
          exponent?: number
          name?: string
        }
        Relationships: []
      }
      deposit_transactions: {
        Row: {
          amount_minor: number
          charge_id: string | null
          created_at: string
          created_by: string | null
          deposit_id: string
          id: string
          journal_id: string | null
          kind: string
          org_id: string
          reason: string | null
        }
        Insert: {
          amount_minor: number
          charge_id?: string | null
          created_at?: string
          created_by?: string | null
          deposit_id: string
          id?: string
          journal_id?: string | null
          kind: string
          org_id: string
          reason?: string | null
        }
        Update: {
          amount_minor?: number
          charge_id?: string | null
          created_at?: string
          created_by?: string | null
          deposit_id?: string
          id?: string
          journal_id?: string | null
          kind?: string
          org_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deposit_transactions_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_transactions_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_transactions_journal_id_fk"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deposits: {
        Row: {
          amount_minor: number
          created_at: string
          currency: string
          deducted_minor: number
          held_minor: number
          id: string
          lease_id: string
          notes: string | null
          org_id: string
          received_at: string | null
          refunded_minor: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          currency?: string
          deducted_minor?: number
          held_minor?: number
          id?: string
          lease_id: string
          notes?: string | null
          org_id: string
          received_at?: string | null
          refunded_minor?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency?: string
          deducted_minor?: number
          held_minor?: number
          id?: string
          lease_id?: string
          notes?: string | null
          org_id?: string
          received_at?: string | null
          refunded_minor?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposits_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: true
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposits_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount_minor: number
          approved_by: string | null
          bank_account_id: string | null
          building_id: string | null
          category: string
          created_at: string
          currency: string
          description: string
          expense_date: string
          id: string
          journal_id: string | null
          notes: string | null
          org_id: string
          paid_at: string | null
          status: Database["public"]["Enums"]["expense_status"]
          submitted_by: string | null
          unit_id: string | null
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          amount_minor: number
          approved_by?: string | null
          bank_account_id?: string | null
          building_id?: string | null
          category: string
          created_at?: string
          currency?: string
          description: string
          expense_date: string
          id?: string
          journal_id?: string | null
          notes?: string | null
          org_id: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          submitted_by?: string | null
          unit_id?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          amount_minor?: number
          approved_by?: string | null
          bank_account_id?: string | null
          building_id?: string | null
          category?: string
          created_at?: string
          currency?: string
          description?: string
          expense_date?: string
          id?: string
          journal_id?: string | null
          notes?: string | null
          org_id?: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          submitted_by?: string | null
          unit_id?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_journal_id_fk"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      floors: {
        Row: {
          building_id: string
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          level: number
          org_id: string
          updated_at: string
        }
        Insert: {
          building_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          level: number
          org_id: string
          updated_at?: string
        }
        Update: {
          building_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          level?: number
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "floors_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: string
          building_id: string | null
          created_at: string
          credit_minor: number
          debit_minor: number
          description: string | null
          id: string
          journal_id: string
          lease_id: string | null
          org_id: string
          tenant_id: string | null
          unit_id: string | null
        }
        Insert: {
          account_id: string
          building_id?: string | null
          created_at?: string
          credit_minor?: number
          debit_minor?: number
          description?: string | null
          id?: string
          journal_id: string
          lease_id?: string | null
          org_id: string
          tenant_id?: string | null
          unit_id?: string | null
        }
        Update: {
          account_id?: string
          building_id?: string | null
          created_at?: string
          credit_minor?: number
          debit_minor?: number
          description?: string | null
          id?: string
          journal_id?: string
          lease_id?: string | null
          org_id?: string
          tenant_id?: string | null
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      journals: {
        Row: {
          created_at: string
          currency: string
          id: string
          memo: string | null
          org_id: string
          posted_at: string
          posted_by: string | null
          reversal_of: string | null
          source_id: string | null
          source_type: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          memo?: string | null
          org_id: string
          posted_at?: string
          posted_by?: string | null
          reversal_of?: string | null
          source_id?: string | null
          source_type: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          memo?: string | null
          org_id?: string
          posted_at?: string
          posted_by?: string | null
          reversal_of?: string | null
          source_id?: string | null
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "journals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journals_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
        ]
      }
      lease_occupants: {
        Row: {
          created_at: string
          created_by: string | null
          full_name: string | null
          id: string
          lease_id: string
          org_id: string
          relation: string | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          full_name?: string | null
          id?: string
          lease_id: string
          org_id: string
          relation?: string | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          full_name?: string | null
          id?: string
          lease_id?: string
          org_id?: string
          relation?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lease_occupants_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_occupants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_occupants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_occupants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lease_terms: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          id: string
          lease_id: string
          note: string | null
          org_id: string
          rent_minor: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from: string
          id?: string
          lease_id: string
          note?: string | null
          org_id: string
          rent_minor: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          lease_id?: string
          note?: string | null
          org_id?: string
          rent_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "lease_terms_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_terms_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leases: {
        Row: {
          contract_path: string | null
          created_at: string
          created_by: string | null
          currency: string
          deposit_minor: number
          due_day: number
          end_date: string
          id: string
          installments: number
          lease_no: string
          notice_days: number
          org_id: string
          parent_lease_id: string | null
          payment_frequency: string
          registration_no: string | null
          registration_status: string
          rent_collected_by: string
          rent_minor: number
          room_id: string | null
          signed_at: string | null
          start_date: string
          status: Database["public"]["Enums"]["lease_status"]
          sublet_approved_at: string | null
          sublet_approved_by: string | null
          tenant_id: string
          terminated_at: string | null
          termination_reason: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          contract_path?: string | null
          created_at?: string
          created_by?: string | null
          currency: string
          deposit_minor?: number
          due_day?: number
          end_date: string
          id?: string
          installments?: number
          lease_no: string
          notice_days?: number
          org_id: string
          parent_lease_id?: string | null
          payment_frequency: string
          registration_no?: string | null
          registration_status?: string
          rent_collected_by?: string
          rent_minor: number
          room_id?: string | null
          signed_at?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["lease_status"]
          sublet_approved_at?: string | null
          sublet_approved_by?: string | null
          tenant_id: string
          terminated_at?: string | null
          termination_reason?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          contract_path?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deposit_minor?: number
          due_day?: number
          end_date?: string
          id?: string
          installments?: number
          lease_no?: string
          notice_days?: number
          org_id?: string
          parent_lease_id?: string | null
          payment_frequency?: string
          registration_no?: string | null
          registration_status?: string
          rent_collected_by?: string
          rent_minor?: number
          room_id?: string | null
          signed_at?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["lease_status"]
          sublet_approved_at?: string | null
          sublet_approved_by?: string | null
          tenant_id?: string
          terminated_at?: string | null
          termination_reason?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leases_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "leases_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_parent_lease_id_fkey"
            columns: ["parent_lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      market_packs: {
        Row: {
          country_code: string
          effective_from: string
          rules: Json
          version: number
        }
        Insert: {
          country_code: string
          effective_from: string
          rules: Json
          version: number
        }
        Update: {
          country_code?: string
          effective_from?: string
          rules?: Json
          version?: number
        }
        Relationships: []
      }
      member_building_access: {
        Row: {
          building_id: string
          created_at: string
          created_by: string | null
          org_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          building_id: string
          created_at?: string
          created_by?: string | null
          org_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          building_id?: string
          created_at?: string
          created_by?: string | null
          org_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_building_access_building_fk"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_building_access_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_branding: {
        Row: {
          app_name: string | null
          created_at: string
          created_by: string | null
          custom_domain: string | null
          email_from: string | null
          favicon_url: string | null
          font_family: string | null
          logo_url: string | null
          org_id: string
          primary_color: string | null
          secondary_color: string | null
          terminology: Json
          updated_at: string
        }
        Insert: {
          app_name?: string | null
          created_at?: string
          created_by?: string | null
          custom_domain?: string | null
          email_from?: string | null
          favicon_url?: string | null
          font_family?: string | null
          logo_url?: string | null
          org_id: string
          primary_color?: string | null
          secondary_color?: string | null
          terminology?: Json
          updated_at?: string
        }
        Update: {
          app_name?: string | null
          created_at?: string
          created_by?: string | null
          custom_domain?: string | null
          email_from?: string | null
          favicon_url?: string | null
          font_family?: string | null
          logo_url?: string | null
          org_id?: string
          primary_color?: string | null
          secondary_color?: string | null
          terminology?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_branding_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          created_by: string | null
          org_id: string
          role: Database["public"]["Enums"]["member_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          org_id: string
          role: Database["public"]["Enums"]["member_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          org_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          base_currency: string
          country_code: string
          created_at: string
          created_by: string | null
          default_locale: string
          id: string
          legal_name: string | null
          name: string
          plan: string
          settings: Json
          slug: string
          status: string
          tax_id: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          base_currency?: string
          country_code?: string
          created_at?: string
          created_by?: string | null
          default_locale?: string
          id?: string
          legal_name?: string | null
          name: string
          plan?: string
          settings?: Json
          slug: string
          status?: string
          tax_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          base_currency?: string
          country_code?: string
          created_at?: string
          created_by?: string | null
          default_locale?: string
          id?: string
          legal_name?: string | null
          name?: string
          plan?: string
          settings?: Json
          slug?: string
          status?: string
          tax_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_base_currency_fkey"
            columns: ["base_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      owner_ledger_entries: {
        Row: {
          amount_minor: number
          building_id: string
          created_at: string
          currency: string
          description: string | null
          entry_date: string
          id: string
          journal_id: string | null
          kind: string
          org_id: string
        }
        Insert: {
          amount_minor: number
          building_id: string
          created_at?: string
          currency?: string
          description?: string | null
          entry_date: string
          id?: string
          journal_id?: string | null
          kind: string
          org_id: string
        }
        Update: {
          amount_minor?: number
          building_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          entry_date?: string
          id?: string
          journal_id?: string | null
          kind?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_ledger_entries_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_ledger_entries_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_ledger_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      owners: {
        Row: {
          approval_threshold_minor: number | null
          contact: Json
          created_at: string
          created_by: string | null
          deleted_at: string | null
          fee_tax_applicable: boolean
          fee_type: string
          fee_value: number
          id: string
          is_company_self: boolean
          letting_fee_months: number
          name: string
          org_id: string
          ownership_model: Database["public"]["Enums"]["ownership_model"]
          payout_details: Json
          payout_frequency: string
          reserve_minor: number
          reserve_pct: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          approval_threshold_minor?: number | null
          contact?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          fee_tax_applicable?: boolean
          fee_type?: string
          fee_value?: number
          id?: string
          is_company_self?: boolean
          letting_fee_months?: number
          name: string
          org_id: string
          ownership_model?: Database["public"]["Enums"]["ownership_model"]
          payout_details?: Json
          payout_frequency?: string
          reserve_minor?: number
          reserve_pct?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          approval_threshold_minor?: number | null
          contact?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          fee_tax_applicable?: boolean
          fee_type?: string
          fee_value?: number
          id?: string
          is_company_self?: boolean
          letting_fee_months?: number
          name?: string
          org_id?: string
          ownership_model?: Database["public"]["Enums"]["ownership_model"]
          payout_details?: Json
          payout_frequency?: string
          reserve_minor?: number
          reserve_pct?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owners_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          amount_minor: number
          charge_id: string
          created_at: string
          id: string
          payment_id: string
        }
        Insert: {
          amount_minor: number
          charge_id: string
          created_at?: string
          id?: string
          payment_id: string
        }
        Update: {
          amount_minor?: number
          charge_id?: string
          created_at?: string
          id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_minor: number
          created_at: string
          created_by: string | null
          currency: string
          id: string
          journal_id: string | null
          lease_id: string | null
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          org_id: string
          receipt_no: number
          receipt_year: number
          received_at: string
          reference: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          journal_id?: string | null
          lease_id?: string | null
          method: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          org_id: string
          receipt_no: number
          receipt_year: number
          received_at: string
          reference?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          journal_id?: string | null
          lease_id?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          org_id?: string
          receipt_no?: number
          receipt_year?: number
          received_at?: string
          reference?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_journal_id_fk"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_org_id: string | null
          created_at: string
          created_by: string | null
          full_name: string | null
          id: string
          locale: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          active_org_id?: string | null
          created_at?: string
          created_by?: string | null
          full_name?: string | null
          id: string
          locale?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active_org_id?: string | null
          created_at?: string
          created_by?: string | null
          full_name?: string | null
          id?: string
          locale?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_org_id_fkey"
            columns: ["active_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_sequences: {
        Row: {
          last_no: number
          org_id: string
          year: number
        }
        Insert: {
          last_no?: number
          org_id: string
          year: number
        }
        Update: {
          last_no?: number
          org_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "receipt_sequences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          area_sqm: number | null
          capacity: number
          created_at: string
          created_by: string | null
          currency: string | null
          default_rent_minor: number | null
          deleted_at: string | null
          id: string
          label: string | null
          org_id: string
          private_bathroom: boolean
          room_no: string
          status: Database["public"]["Enums"]["unit_status"]
          unit_id: string
          updated_at: string
        }
        Insert: {
          area_sqm?: number | null
          capacity?: number
          created_at?: string
          created_by?: string | null
          currency?: string | null
          default_rent_minor?: number | null
          deleted_at?: string | null
          id?: string
          label?: string | null
          org_id: string
          private_bathroom?: boolean
          room_no: string
          status?: Database["public"]["Enums"]["unit_status"]
          unit_id: string
          updated_at?: string
        }
        Update: {
          area_sqm?: number | null
          capacity?: number
          created_at?: string
          created_by?: string | null
          currency?: string | null
          default_rent_minor?: number | null
          deleted_at?: string | null
          id?: string
          label?: string | null
          org_id?: string
          private_bathroom?: boolean
          room_no?: string
          status?: Database["public"]["Enums"]["unit_status"]
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "rooms_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_credits: {
        Row: {
          amount_minor: number
          created_at: string
          id: string
          note: string | null
          org_id: string
          remaining_minor: number
          source_payment_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          id?: string
          note?: string | null
          org_id: string
          remaining_minor: number
          source_payment_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          id?: string
          note?: string | null
          org_id?: string
          remaining_minor?: number
          source_payment_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_credits_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_credits_source_payment_id_fkey"
            columns: ["source_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_credits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_credits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          emergency_contact: Json | null
          employer: string | null
          full_name: string
          id: string
          id_expiry: string | null
          id_number_enc: string | null
          id_type: string | null
          kind: string
          language: string
          nationality: string | null
          org_id: string
          phone: string | null
          updated_at: string
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          emergency_contact?: Json | null
          employer?: string | null
          full_name: string
          id?: string
          id_expiry?: string | null
          id_number_enc?: string | null
          id_type?: string | null
          kind?: string
          language?: string
          nationality?: string | null
          org_id: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          emergency_contact?: Json | null
          employer?: string | null
          full_name?: string
          id?: string
          id_expiry?: string | null
          id_number_enc?: string | null
          id_type?: string | null
          kind?: string
          language?: string
          nationality?: string | null
          org_id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          area_sqm: number | null
          bathrooms: number | null
          bedrooms: number | null
          building_id: string
          created_at: string
          created_by: string | null
          currency: string | null
          default_rent_minor: number | null
          deleted_at: string | null
          electricity_no: string | null
          floor_id: string
          furnished: boolean
          id: string
          occupancy_type: string
          org_id: string
          rentable_as: string
          status: Database["public"]["Enums"]["unit_status"]
          unit_no: string
          unit_type: string | null
          updated_at: string
          water_no: string | null
        }
        Insert: {
          area_sqm?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          building_id: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          default_rent_minor?: number | null
          deleted_at?: string | null
          electricity_no?: string | null
          floor_id: string
          furnished?: boolean
          id?: string
          occupancy_type?: string
          org_id: string
          rentable_as?: string
          status?: Database["public"]["Enums"]["unit_status"]
          unit_no: string
          unit_type?: string | null
          updated_at?: string
          water_no?: string | null
        }
        Update: {
          area_sqm?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          building_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          default_rent_minor?: number | null
          deleted_at?: string | null
          electricity_no?: string | null
          floor_id?: string
          furnished?: boolean
          id?: string
          occupancy_type?: string
          org_id?: string
          rentable_as?: string
          status?: Database["public"]["Enums"]["unit_status"]
          unit_no?: string
          unit_type?: string | null
          updated_at?: string
          water_no?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "units_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          category: string | null
          contact: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          org_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          contact?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          org_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          contact?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      pg_all_foreign_keys: {
        Row: {
          fk_columns: unknown[] | null
          fk_constraint_name: unknown
          fk_schema_name: unknown
          fk_table_name: unknown
          fk_table_oid: unknown
          is_deferrable: boolean | null
          is_deferred: boolean | null
          match_type: string | null
          on_delete: string | null
          on_update: string | null
          pk_columns: unknown[] | null
          pk_constraint_name: unknown
          pk_index_name: unknown
          pk_schema_name: unknown
          pk_table_name: unknown
          pk_table_oid: unknown
        }
        Relationships: []
      }
      tap_funky: {
        Row: {
          args: string | null
          is_definer: boolean | null
          is_strict: boolean | null
          is_visible: boolean | null
          kind: unknown
          langoid: unknown
          name: unknown
          oid: unknown
          owner: unknown
          returns: string | null
          returns_set: boolean | null
          schema: unknown
          volatility: string | null
        }
        Relationships: []
      }
      tenant_directory: {
        Row: {
          deleted_at: string | null
          email: string | null
          employer: string | null
          full_name: string | null
          id: string | null
          kind: string | null
          language: string | null
          nationality: string | null
          org_id: string | null
          phone: string | null
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          deleted_at?: string | null
          email?: string | null
          employer?: string | null
          full_name?: string | null
          id?: string | null
          kind?: string | null
          language?: string | null
          nationality?: string | null
          org_id?: string | null
          phone?: string | null
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          deleted_at?: string | null
          email?: string | null
          employer?: string | null
          full_name?: string | null
          id?: string | null
          kind?: string | null
          language?: string | null
          nationality?: string | null
          org_id?: string | null
          phone?: string | null
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _cleanup: { Args: never; Returns: boolean }
      _contract_on: { Args: { "": string }; Returns: unknown }
      _currtest: { Args: never; Returns: number }
      _db_privs: { Args: never; Returns: unknown[] }
      _extensions: { Args: never; Returns: unknown[] }
      _get: { Args: { "": string }; Returns: number }
      _get_latest: { Args: { "": string }; Returns: number[] }
      _get_note: { Args: { "": string }; Returns: string }
      _is_verbose: { Args: never; Returns: boolean }
      _prokind: { Args: { p_oid: unknown }; Returns: unknown }
      _query: { Args: { "": string }; Returns: string }
      _refine_vol: { Args: { "": string }; Returns: string }
      _retval: { Args: { "": string }; Returns: string }
      _table_privs: { Args: never; Returns: unknown[] }
      _temptypes: { Args: { "": string }; Returns: string }
      _todo: { Args: never; Returns: string }
      activate_lease: { Args: { p_lease: string }; Returns: undefined }
      apply_deposit_deduction: {
        Args: {
          p_amount: number
          p_charge_id?: string
          p_deposit_id: string
          p_reason: string
        }
        Returns: undefined
      }
      approve_expense: { Args: { p_expense_id: string }; Returns: undefined }
      auth_org: { Args: never; Returns: string }
      auth_role: { Args: never; Returns: string }
      bounce_cheque: {
        Args: { p_cheque_id: string; p_reason?: string }
        Returns: undefined
      }
      can_access_building: { Args: { b: string }; Returns: boolean }
      can_access_lease: {
        Args: { p_room: string; p_unit: string }
        Returns: boolean
      }
      clear_cheque: { Args: { p_cheque_id: string }; Returns: string }
      close_period: { Args: { p_month: string }; Returns: undefined }
      col_is_null:
        | {
            Args: {
              column_name: unknown
              description?: string
              schema_name: unknown
              table_name: unknown
            }
            Returns: string
          }
        | {
            Args: {
              column_name: unknown
              description?: string
              table_name: unknown
            }
            Returns: string
          }
      col_not_null:
        | {
            Args: {
              column_name: unknown
              description?: string
              schema_name: unknown
              table_name: unknown
            }
            Returns: string
          }
        | {
            Args: {
              column_name: unknown
              description?: string
              table_name: unknown
            }
            Returns: string
          }
      create_organization: {
        Args: {
          p_base_currency?: string
          p_country_code?: string
          p_locale?: string
          p_name: string
          p_slug: string
        }
        Returns: string
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      decrypt_id: { Args: { p_ciphertext: string }; Returns: string }
      deposit_cheque: {
        Args: { p_bank_account_id?: string; p_cheque_id: string }
        Returns: undefined
      }
      diag:
        | {
            Args: { msg: unknown }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { msg: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      diag_test_name: { Args: { "": string }; Returns: string }
      do_tap:
        | { Args: never; Returns: string[] }
        | { Args: { "": string }; Returns: string[] }
      encrypt_id: { Args: { p_plaintext: string }; Returns: string }
      fail:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string }
      findfuncs: { Args: { "": string }; Returns: string[] }
      finish: { Args: { exception_on_failure?: boolean }; Returns: string[] }
      format_type_string: { Args: { "": string }; Returns: string }
      generate_floors: {
        Args: { p_building: string; p_from: number; p_to: number }
        Returns: number
      }
      generate_lease_charges: { Args: { p_lease: string }; Returns: number }
      generate_units: {
        Args: {
          p_area_sqm?: number
          p_count?: number
          p_floor: string
          p_pad?: number
          p_prefix?: string
          p_rent_minor?: number
          p_start?: number
          p_unit_type?: string
        }
        Returns: number
      }
      has_unique: { Args: { "": string }; Returns: string }
      import_property_rows: {
        Args: { p_dry_run?: boolean; p_rows: Json }
        Returns: Json
      }
      in_todo: { Args: never; Returns: boolean }
      is_empty: { Args: { "": string }; Returns: string }
      isnt_empty: { Args: { "": string }; Returns: string }
      lease_building_id: { Args: { p_lease: string }; Returns: string }
      lease_capacity: { Args: { p_lease: string }; Returns: number }
      leases_expiring: {
        Args: { p_days?: number }
        Returns: {
          days_left: number
          end_date: string
          lease_id: string
          lease_no: string
          tenant_name: string
        }[]
      }
      lives_ok: { Args: { "": string }; Returns: string }
      next_receipt_number: {
        Args: { p_org: string; p_year?: number }
        Returns: number
      }
      no_plan: { Args: never; Returns: boolean[] }
      num_failed: { Args: never; Returns: number }
      os_name: { Args: never; Returns: string }
      pass:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string }
      pay_expense: {
        Args: { p_bank_account_id?: string; p_expense_id: string }
        Returns: undefined
      }
      pg_version: { Args: never; Returns: string }
      pg_version_num: { Args: never; Returns: number }
      pgtap_version: { Args: never; Returns: number }
      post_journal: {
        Args: {
          p_currency?: string
          p_lines: Json
          p_memo?: string
          p_source_id: string
          p_source_type: string
        }
        Returns: string
      }
      record_expense: {
        Args: {
          p_amount: number
          p_building_id?: string
          p_category: string
          p_currency?: string
          p_date: string
          p_description: string
          p_notes?: string
          p_unit_id?: string
          p_vendor_id?: string
        }
        Returns: string
      }
      record_payment: {
        Args: {
          p_allocations?: Json
          p_amount: number
          p_currency?: string
          p_lease_id?: string
          p_method?: Database["public"]["Enums"]["payment_method"]
          p_notes?: string
          p_received_at?: string
          p_reference?: string
          p_tenant_id: string
        }
        Returns: string
      }
      refund_deposit: {
        Args: { p_amount: number; p_deposit_id: string; p_reason?: string }
        Returns: undefined
      }
      register_cheque: {
        Args: {
          p_amount: number
          p_bank_name: string
          p_cheque_date: string
          p_cheque_no: string
          p_currency?: string
          p_lease_id: string
          p_notes?: string
          p_tenant_id: string
        }
        Returns: string
      }
      renew_lease: { Args: { p_lease: string; p_terms: Json }; Returns: string }
      reopen_period: {
        Args: { p_month: string; p_reason?: string }
        Returns: undefined
      }
      replace_cheque: {
        Args: {
          p_amount: number
          p_bank_name: string
          p_cheque_date: string
          p_cheque_no: string
          p_currency?: string
          p_notes?: string
          p_old_cheque_id: string
        }
        Returns: string
      }
      reverse_journal: {
        Args: { p_journal_id: string; p_reason?: string }
        Returns: string
      }
      runtests:
        | { Args: never; Returns: string[] }
        | { Args: { "": string }; Returns: string[] }
      seed_chart_of_accounts: { Args: { p_org: string }; Returns: undefined }
      set_active_org: { Args: { p_org: string }; Returns: undefined }
      skip:
        | { Args: { "": string }; Returns: string }
        | { Args: { how_many: number; why: string }; Returns: string }
      tenant_id_number: { Args: { p_tenant: string }; Returns: string }
      terminate_lease: {
        Args: { p_date: string; p_lease: string; p_reason: string }
        Returns: undefined
      }
      throws_ok: { Args: { "": string }; Returns: string }
      todo:
        | { Args: { how_many: number }; Returns: boolean[] }
        | { Args: { how_many: number; why: string }; Returns: boolean[] }
        | { Args: { why: string }; Returns: boolean[] }
        | { Args: { how_many: number; why: string }; Returns: boolean[] }
      todo_end: { Args: never; Returns: boolean[] }
      todo_start:
        | { Args: never; Returns: boolean[] }
        | { Args: { "": string }; Returns: boolean[] }
    }
    Enums: {
      account_type: "asset" | "liability" | "equity" | "revenue" | "expense"
      charge_status: "pending" | "partial" | "paid" | "overdue" | "void"
      charge_type:
        | "rent"
        | "deposit"
        | "utility"
        | "maintenance"
        | "late_fee"
        | "other"
      cheque_status:
        | "received"
        | "deposited"
        | "cleared"
        | "bounced"
        | "returned"
        | "replaced"
      expense_status: "draft" | "submitted" | "approved" | "paid" | "rejected"
      lease_status: "draft" | "active" | "expired" | "terminated" | "renewed"
      maint_priority: "low" | "normal" | "high" | "urgent"
      maint_status:
        | "open"
        | "assigned"
        | "in_progress"
        | "resolved"
        | "closed"
        | "cancelled"
      member_role:
        | "org_admin"
        | "manager"
        | "accountant"
        | "caretaker"
        | "owner"
        | "tenant"
      ownership_model: "self" | "managed"
      payment_method: "cash" | "bank_transfer" | "cheque" | "card" | "online"
      period_status: "open" | "closed"
      unit_status: "vacant" | "occupied" | "reserved" | "maintenance"
    }
    CompositeTypes: {
      _time_trial_type: {
        a_time: number | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_type: ["asset", "liability", "equity", "revenue", "expense"],
      charge_status: ["pending", "partial", "paid", "overdue", "void"],
      charge_type: [
        "rent",
        "deposit",
        "utility",
        "maintenance",
        "late_fee",
        "other",
      ],
      cheque_status: [
        "received",
        "deposited",
        "cleared",
        "bounced",
        "returned",
        "replaced",
      ],
      expense_status: ["draft", "submitted", "approved", "paid", "rejected"],
      lease_status: ["draft", "active", "expired", "terminated", "renewed"],
      maint_priority: ["low", "normal", "high", "urgent"],
      maint_status: [
        "open",
        "assigned",
        "in_progress",
        "resolved",
        "closed",
        "cancelled",
      ],
      member_role: [
        "org_admin",
        "manager",
        "accountant",
        "caretaker",
        "owner",
        "tenant",
      ],
      ownership_model: ["self", "managed"],
      payment_method: ["cash", "bank_transfer", "cheque", "card", "online"],
      period_status: ["open", "closed"],
      unit_status: ["vacant", "occupied", "reserved", "maintenance"],
    },
  },
} as const
