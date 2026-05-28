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
      ai_company_settings: {
        Row: {
          ask_referral_for_new: boolean
          company_id: string
          created_at: string
          escalate_when_referrer_missing: boolean
          human_handoff_number: string | null
          support_instructions: string | null
          updated_at: string
        }
        Insert: {
          ask_referral_for_new?: boolean
          company_id: string
          created_at?: string
          escalate_when_referrer_missing?: boolean
          human_handoff_number?: string | null
          support_instructions?: string | null
          updated_at?: string
        }
        Update: {
          ask_referral_for_new?: boolean
          company_id?: string
          created_at?: string
          escalate_when_referrer_missing?: boolean
          human_handoff_number?: string | null
          support_instructions?: string | null
          updated_at?: string
        }
        Relationships: []
      }
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
      app_support_kb: {
        Row: {
          app_name: string
          common_issues: string | null
          company_id: string
          created_at: string
          default_reply: string | null
          escalate_when: string | null
          how_to_change_route: string | null
          how_to_update: string | null
          id: string
          is_active: boolean
          is_paid: boolean
          login_type: string
          stability_level: string
          updated_at: string
        }
        Insert: {
          app_name: string
          common_issues?: string | null
          company_id: string
          created_at?: string
          default_reply?: string | null
          escalate_when?: string | null
          how_to_change_route?: string | null
          how_to_update?: string | null
          id?: string
          is_active?: boolean
          is_paid?: boolean
          login_type?: string
          stability_level?: string
          updated_at?: string
        }
        Update: {
          app_name?: string
          common_issues?: string | null
          company_id?: string
          created_at?: string
          default_reply?: string | null
          escalate_when?: string | null
          how_to_change_route?: string | null
          how_to_update?: string | null
          id?: string
          is_active?: boolean
          is_paid?: boolean
          login_type?: string
          stability_level?: string
          updated_at?: string
        }
        Relationships: []
      }
      auth_email_otps: {
        Row: {
          attempts: number
          consumed_at: string | null
          created_at: string
          email_normalized: string
          expires_at: string
          id: string
          max_attempts: number
          metadata: Json
          otp_hash: string
          purpose: Database["public"]["Enums"]["otp_purpose"]
          resend_available_at: string
        }
        Insert: {
          attempts?: number
          consumed_at?: string | null
          created_at?: string
          email_normalized: string
          expires_at: string
          id?: string
          max_attempts?: number
          metadata?: Json
          otp_hash: string
          purpose: Database["public"]["Enums"]["otp_purpose"]
          resend_available_at?: string
        }
        Update: {
          attempts?: number
          consumed_at?: string | null
          created_at?: string
          email_normalized?: string
          expires_at?: string
          id?: string
          max_attempts?: number
          metadata?: Json
          otp_hash?: string
          purpose?: Database["public"]["Enums"]["otp_purpose"]
          resend_available_at?: string
        }
        Relationships: []
      }
      auth_login_locks: {
        Row: {
          created_at: string
          email_normalized: string
          failed_attempts: number
          id: string
          ip: string
          last_failed_at: string
          locked_until: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email_normalized: string
          failed_attempts?: number
          id?: string
          ip: string
          last_failed_at?: string
          locked_until?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email_normalized?: string
          failed_attempts?: number
          id?: string
          ip?: string
          last_failed_at?: string
          locked_until?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      auth_pending_signups: {
        Row: {
          created_at: string
          email_normalized: string
          expires_at: string
          id: string
          metadata: Json
          password_hash: string
        }
        Insert: {
          created_at?: string
          email_normalized: string
          expires_at: string
          id?: string
          metadata?: Json
          password_hash: string
        }
        Update: {
          created_at?: string
          email_normalized?: string
          expires_at?: string
          id?: string
          metadata?: Json
          password_hash?: string
        }
        Relationships: []
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
      company_ai_usage_cycle: {
        Row: {
          base_limit: number
          blocked_at: string | null
          company_id: string
          created_at: string
          cycle_end: string
          cycle_start: string
          extra_limit: number
          id: string
          last_increment_at: string | null
          updated_at: string
          used_count: number
          warned_70_at: string | null
          warned_90_at: string | null
        }
        Insert: {
          base_limit?: number
          blocked_at?: string | null
          company_id: string
          created_at?: string
          cycle_end: string
          cycle_start: string
          extra_limit?: number
          id?: string
          last_increment_at?: string | null
          updated_at?: string
          used_count?: number
          warned_70_at?: string | null
          warned_90_at?: string | null
        }
        Update: {
          base_limit?: number
          blocked_at?: string | null
          company_id?: string
          created_at?: string
          cycle_end?: string
          cycle_start?: string
          extra_limit?: number
          id?: string
          last_increment_at?: string | null
          updated_at?: string
          used_count?: number
          warned_70_at?: string | null
          warned_90_at?: string | null
        }
        Relationships: []
      }
      company_extra_pack_purchases: {
        Row: {
          company_id: string
          created_at: string
          cycle_start: string
          extra_responses: number
          id: string
          pack_id: string
          price_cents: number
          purchased_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          cycle_start: string
          extra_responses?: number
          id?: string
          pack_id: string
          price_cents?: number
          purchased_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          cycle_start?: string
          extra_responses?: number
          id?: string
          pack_id?: string
          price_cents?: number
          purchased_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_extra_pack_purchases_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "saas_extra_packs"
            referencedColumns: ["id"]
          },
        ]
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
      company_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          company_id: string
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          last_payment_at: string | null
          paused_limit_notified_at: string | null
          plan_id: string
          status: string
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          company_id: string
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          last_payment_at?: string | null
          paused_limit_notified_at?: string | null
          plan_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          company_id?: string
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          last_payment_at?: string | null
          paused_limit_notified_at?: string | null
          plan_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "saas_plans"
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
          price_group_id: string | null
          referral_customer_id: string | null
          referral_raw: string | null
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
          price_group_id?: string | null
          referral_customer_id?: string | null
          referral_raw?: string | null
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
          price_group_id?: string | null
          referral_customer_id?: string | null
          referral_raw?: string | null
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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      price_group_plans: {
        Row: {
          allow_installments: boolean
          company_id: string
          created_at: string
          duration_days: number
          id: string
          is_active: boolean
          name: string
          notes: string | null
          price_cents: number
          price_group_id: string
          screens: number
          updated_at: string
        }
        Insert: {
          allow_installments?: boolean
          company_id: string
          created_at?: string
          duration_days?: number
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          price_cents?: number
          price_group_id: string
          screens?: number
          updated_at?: string
        }
        Update: {
          allow_installments?: boolean
          company_id?: string
          created_at?: string
          duration_days?: number
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          price_cents?: number
          price_group_id?: string
          screens?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_group_plans_price_group_id_fkey"
            columns: ["price_group_id"]
            isOneToOne: false
            referencedRelation: "price_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      price_groups: {
        Row: {
          ai_notes: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          priority: number
          updated_at: string
        }
        Insert: {
          ai_notes?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          priority?: number
          updated_at?: string
        }
        Update: {
          ai_notes?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          priority?: number
          updated_at?: string
        }
        Relationships: []
      }
      saas_extra_packs: {
        Row: {
          ai_extra_responses: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          price_cents: number
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          ai_extra_responses?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          price_cents?: number
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          ai_extra_responses?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      saas_plans: {
        Row: {
          ai_monthly_limit: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          price_cents: number
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          ai_monthly_limit?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          price_cents?: number
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          ai_monthly_limit?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
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
      whatsapp_automation_logs: {
        Row: {
          company_id: string
          created_at: string
          details: Json
          error: string | null
          event_type: string
          from_phone: string | null
          id: string
          instance_id: string | null
          message_preview: string | null
          provider_event: string | null
          provider_instance: string | null
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          details?: Json
          error?: string | null
          event_type: string
          from_phone?: string | null
          id?: string
          instance_id?: string | null
          message_preview?: string | null
          provider_event?: string | null
          provider_instance?: string | null
          status: string
        }
        Update: {
          company_id?: string
          created_at?: string
          details?: Json
          error?: string | null
          event_type?: string
          from_phone?: string | null
          id?: string
          instance_id?: string | null
          message_preview?: string | null
          provider_event?: string | null
          provider_instance?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_automation_logs_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversation_state: {
        Row: {
          classification: string | null
          company_id: string
          created_at: string
          flags: Json
          from_phone: string
          human_notified_at: string | null
          human_reason: string | null
          id: string
          instance_id: string
          last_messages: Json
          last_response_at: string | null
          last_response_hash: string | null
          muted_until: string | null
          needs_human: boolean
          responses_hour_window: Json
          summary: string | null
          total_messages_in: number
          total_messages_out: number
          updated_at: string
        }
        Insert: {
          classification?: string | null
          company_id: string
          created_at?: string
          flags?: Json
          from_phone: string
          human_notified_at?: string | null
          human_reason?: string | null
          id?: string
          instance_id: string
          last_messages?: Json
          last_response_at?: string | null
          last_response_hash?: string | null
          muted_until?: string | null
          needs_human?: boolean
          responses_hour_window?: Json
          summary?: string | null
          total_messages_in?: number
          total_messages_out?: number
          updated_at?: string
        }
        Update: {
          classification?: string | null
          company_id?: string
          created_at?: string
          flags?: Json
          from_phone?: string
          human_notified_at?: string | null
          human_reason?: string | null
          id?: string
          instance_id?: string
          last_messages?: Json
          last_response_at?: string | null
          last_response_hash?: string | null
          muted_until?: string | null
          needs_human?: boolean
          responses_hour_window?: Json
          summary?: string | null
          total_messages_in?: number
          total_messages_out?: number
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_inbound_messages: {
        Row: {
          body: string | null
          company_id: string
          created_at: string
          from_phone: string
          id: string
          instance_id: string
          provider_msg_id: string
          replied_at: string | null
          reply_error: string | null
          reply_status: string
          reply_text: string | null
        }
        Insert: {
          body?: string | null
          company_id: string
          created_at?: string
          from_phone: string
          id?: string
          instance_id: string
          provider_msg_id: string
          replied_at?: string | null
          reply_error?: string | null
          reply_status?: string
          reply_text?: string | null
        }
        Update: {
          body?: string | null
          company_id?: string
          created_at?: string
          from_phone?: string
          id?: string
          instance_id?: string
          provider_msg_id?: string
          replied_at?: string | null
          reply_error?: string | null
          reply_status?: string
          reply_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_inbound_messages_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          ai_reply_enabled: boolean
          ai_system_prompt: string | null
          company_id: string
          created_at: string
          daily_limit: number
          daily_sent_count: number
          friendly_name: string
          id: string
          last_activity_at: string | null
          pairing_code: string | null
          pairing_code_expires_at: string | null
          per_minute_limit: number
          phone_number: string | null
          provider: string
          provider_instance_id: string
          qr_code: string | null
          qr_expires_at: string | null
          reject_call_enabled: boolean
          reject_call_message: string | null
          status: Database["public"]["Enums"]["wa_instance_status"]
          updated_at: string
          vps_node_id: string
        }
        Insert: {
          ai_reply_enabled?: boolean
          ai_system_prompt?: string | null
          company_id: string
          created_at?: string
          daily_limit?: number
          daily_sent_count?: number
          friendly_name: string
          id?: string
          last_activity_at?: string | null
          pairing_code?: string | null
          pairing_code_expires_at?: string | null
          per_minute_limit?: number
          phone_number?: string | null
          provider?: string
          provider_instance_id: string
          qr_code?: string | null
          qr_expires_at?: string | null
          reject_call_enabled?: boolean
          reject_call_message?: string | null
          status?: Database["public"]["Enums"]["wa_instance_status"]
          updated_at?: string
          vps_node_id: string
        }
        Update: {
          ai_reply_enabled?: boolean
          ai_system_prompt?: string | null
          company_id?: string
          created_at?: string
          daily_limit?: number
          daily_sent_count?: number
          friendly_name?: string
          id?: string
          last_activity_at?: string | null
          pairing_code?: string | null
          pairing_code_expires_at?: string | null
          per_minute_limit?: number
          phone_number?: string | null
          provider?: string
          provider_instance_id?: string
          qr_code?: string | null
          qr_expires_at?: string | null
          reject_call_enabled?: boolean
          reject_call_message?: string | null
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
      cleanup_auth_ephemeral: { Args: never; Returns: undefined }
      current_user_is_super_admin: { Args: never; Returns: boolean }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_or_create_current_ai_cycle: {
        Args: { _company_id: string }
        Returns: {
          base_limit: number
          blocked_at: string | null
          company_id: string
          created_at: string
          cycle_end: string
          cycle_start: string
          extra_limit: number
          id: string
          last_increment_at: string | null
          updated_at: string
          used_count: number
          warned_70_at: string | null
          warned_90_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "company_ai_usage_cycle"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_company_access: { Args: { _company_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_ai_usage: {
        Args: { _company_id: string }
        Returns: {
          base_limit: number
          blocked_at: string | null
          company_id: string
          created_at: string
          cycle_end: string
          cycle_start: string
          extra_limit: number
          id: string
          last_increment_at: string | null
          updated_at: string
          used_count: number
          warned_70_at: string | null
          warned_90_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "company_ai_usage_cycle"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_super_admin: { Args: never; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      ai_usage_status: "success" | "error"
      ai_usage_type: "owner" | "customer"
      app_role: "super_admin" | "owner" | "member"
      otp_purpose: "signup" | "login" | "recovery"
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
      otp_purpose: ["signup", "login", "recovery"],
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
