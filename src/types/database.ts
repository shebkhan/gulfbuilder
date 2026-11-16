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
      profiles: {
        Row: {
          created_at: string
          created_by: string | null
          full_name: string | null
          id: string
          locale: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          full_name?: string | null
          id: string
          locale?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          full_name?: string | null
          id?: string
          locale?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_org: { Args: never; Returns: string }
      auth_role: { Args: never; Returns: string }
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
    }
    Enums: {
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
      unit_status: "vacant" | "occupied" | "reserved" | "maintenance"
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
      unit_status: ["vacant", "occupied", "reserved", "maintenance"],
    },
  },
} as const
