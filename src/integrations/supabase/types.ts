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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_usage_log: {
        Row: {
          company_id: string
          completion_tokens: number
          created_at: string
          customer_id: string | null
          error_reason: string | null
          estimated_cost_usd: number
          id: string
          model: string
          prompt_tokens: number
          status: Database["public"]["Enums"]["ai_usage_status"]
          total_tokens: number
          usage_type: Database["public"]["Enums"]["ai_usage_type"]
          user_id: string | null
        }
        Insert: {
          company_id: string
          completion_tokens?: number
          created_at?: string
          customer_id?: string | null
          error_reason?: string | null
          estimated_cost_usd?: number
          id?: string
          model: string
          prompt_tokens?: number
          status: Database["public"]["Enums"]["ai_usage_status"]
          total_tokens?: number
          usage_type: Database["public"]["Enums"]["ai_usage_type"]
          user_id?: string | null
        }
        Update: {
          company_id?: string
          completion_tokens?: number
          created_at?: string
          customer_id?: string | null
          error_reason?: string | null
          estimated_cost_usd?: number
          id?: string
          model?: string
          prompt_tokens?: number
          status?: Database["public"]["Enums"]["ai_usage_status"]
          total_tokens?: number
          usage_type?: Database["public"]["Enums"]["ai_usage_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_support_tokens: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          customer_id: string | null
          expires_at: string
          id: string
          is_active: boolean
          last_used_at: string | null
          token_hash: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          customer_id?: string | null
          expires_at: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          token_hash: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          customer_id?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_support_tokens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_support_tokens_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          company_id: string
          created_at: string
          document: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_instances: {
        Row: {
          company_id: string
          created_at: string
          daily_limit: number
          daily_sent_count: number
          friendly_name: string
          id: string
          last_activity_at: string | null
          per_minute_limit: number
          phone_number: string | null
          provider: string
          provider_instance_id: string
          qr_code: string | null
          qr_expires_at: string | null
          status: Database["public"]["Enums"]["wa_instance_status"]
          updated_at: string
          vps_node_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          daily_limit?: number
          daily_sent_count?: number
          friendly_name: string
          id?: string
          last_activity_at?: string | null
          per_minute_limit?: number
          phone_number?: string | null
          provider?: string
          provider_instance_id: string
          qr_code?: string | null
          qr_expires_at?: string | null
          status?: Database["public"]["Enums"]["wa_instance_status"]
          updated_at?: string
          vps_node_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          daily_limit?: number
          daily_sent_count?: number
          friendly_name?: string
          id?: string
          last_activity_at?: string | null
          per_minute_limit?: number
          phone_number?: string | null
          provider?: string
          provider_instance_id?: string
          qr_code?: string | null
          qr_expires_at?: string | null
          status?: Database["public"]["Enums"]["wa_instance_status"]
          updated_at?: string
          vps_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_instances_vps_node_id_fkey"
            columns: ["vps_node_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_vps_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_message_queue: {
        Row: {
          attempts: number
          body: string
          company_id: string
          created_at: string
          id: string
          instance_id: string
          last_error: string | null
          max_attempts: number
          next_attempt_at: string
          provider_msg_id: string | null
          scheduled_for: string
          sent_at: string | null
          status: Database["public"]["Enums"]["wa_message_status"]
          to_phone: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          body: string
          company_id: string
          created_at?: string
          id?: string
          instance_id: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          provider_msg_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["wa_message_status"]
          to_phone: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          body?: string
          company_id?: string
          created_at?: string
          id?: string
          instance_id?: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          provider_msg_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["wa_message_status"]
          to_phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_queue_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_message_queue_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_vps_nodes: {
        Row: {
          api_token_enc: string
          base_url: string
          cpu_pct: number | null
          created_at: string
          disk_pct: number | null
          health: Database["public"]["Enums"]["wa_vps_health"]
          id: string
          is_active: boolean
          last_health_at: string | null
          max_instances: number
          name: string
          ram_pct: number | null
          updated_at: string
          uptime_seconds: number | null
          webhook_secret: string
        }
        Insert: {
          api_token_enc: string
          base_url: string
          cpu_pct?: number | null
          created_at?: string
          disk_pct?: number | null
          health?: Database["public"]["Enums"]["wa_vps_health"]
          id?: string
          is_active?: boolean
          last_health_at?: string | null
          max_instances?: number
          name: string
          ram_pct?: number | null
          updated_at?: string
          uptime_seconds?: number | null
          webhook_secret: string
        }
        Update: {
          api_token_enc?: string
          base_url?: string
          cpu_pct?: number | null
          created_at?: string
          disk_pct?: number | null
          health?: Database["public"]["Enums"]["wa_vps_health"]
          id?: string
          is_active?: boolean
          last_health_at?: string | null
          max_instances?: number
          name?: string
          ram_pct?: number | null
          updated_at?: string
          uptime_seconds?: number | null
          webhook_secret?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_super_admin_bootstrap: { Args: never; Returns: Json }
      has_company_access: { Args: { _company_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      ai_usage_status: "success" | "error"
      ai_usage_type: "owner" | "customer"
      app_role: "super_admin" | "owner" | "member"
      wa_instance_status:
        | "connected"
        | "disconnected"
        | "awaiting_qr"
        | "error"
        | "blocked"
      wa_message_status:
        | "queued"
        | "sending"
        | "sent"
        | "delivered"
        | "read"
        | "failed"
      wa_vps_health:
        | "healthy"
        | "attention"
        | "upgrade_recommended"
        | "upgrade_urgent"
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
      ai_usage_status: ["success", "error"],
      ai_usage_type: ["owner", "customer"],
      app_role: ["super_admin", "owner", "member"],
      wa_instance_status: [
        "connected",
        "disconnected",
        "awaiting_qr",
        "error",
        "blocked",
      ],
      wa_message_status: [
        "queued",
        "sending",
        "sent",
        "delivered",
        "read",
        "failed",
      ],
      wa_vps_health: [
        "healthy",
        "attention",
        "upgrade_recommended",
        "upgrade_urgent",
      ],
    },
  },
} as const
