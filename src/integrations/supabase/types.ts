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
      ai_knowledge_entries: {
        Row: {
          active: boolean
          app: string | null
          category: string
          company_id: string
          created_at: string
          full_text: string
          id: string
          keywords: string[]
          needs_human: boolean
          short_text: string
          title: string
          updated_at: string
          when_not_to_use: string | null
          when_to_use: string | null
        }
        Insert: {
          active?: boolean
          app?: string | null
          category?: string
          company_id: string
          created_at?: string
          full_text?: string
          id?: string
          keywords?: string[]
          needs_human?: boolean
          short_text?: string
          title: string
          updated_at?: string
          when_not_to_use?: string | null
          when_to_use?: string | null
        }
        Update: {
          active?: boolean
          app?: string | null
          category?: string
          company_id?: string
          created_at?: string
          full_text?: string
          id?: string
          keywords?: string[]
          needs_human?: boolean
          short_text?: string
          title?: string
          updated_at?: string
          when_not_to_use?: string | null
          when_to_use?: string | null
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
      company_ai_app_guides: {
        Row: {
          app_name: string
          app_price_cents: number
          cache_steps: string | null
          common_issues: string | null
          company_id: string
          created_at: string
          default_reply: string | null
          id: string
          install_steps: string | null
          is_active: boolean
          is_paid: boolean
          login_type: string
          route_steps: string | null
          update_steps: string | null
          updated_at: string
        }
        Insert: {
          app_name: string
          app_price_cents?: number
          cache_steps?: string | null
          common_issues?: string | null
          company_id: string
          created_at?: string
          default_reply?: string | null
          id?: string
          install_steps?: string | null
          is_active?: boolean
          is_paid?: boolean
          login_type?: string
          route_steps?: string | null
          update_steps?: string | null
          updated_at?: string
        }
        Update: {
          app_name?: string
          app_price_cents?: number
          cache_steps?: string | null
          common_issues?: string | null
          company_id?: string
          created_at?: string
          default_reply?: string | null
          id?: string
          install_steps?: string | null
          is_active?: boolean
          is_paid?: boolean
          login_type?: string
          route_steps?: string | null
          update_steps?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_ai_faqs: {
        Row: {
          answer: string
          category: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          category?: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_ai_knowledge: {
        Row: {
          accepts_audio: boolean
          allow_after_hours: boolean
          allow_paid_apps_info: boolean
          answer_length: string
          auto_offer_trial: boolean
          company_id: string
          created_at: string
          human_on_complaint: boolean
          human_when_unsure: boolean
          id: string
          knowledge_text: string
          tone: string
          updated_at: string
          use_manual_pix_fallback: boolean
        }
        Insert: {
          accepts_audio?: boolean
          allow_after_hours?: boolean
          allow_paid_apps_info?: boolean
          answer_length?: string
          auto_offer_trial?: boolean
          company_id: string
          created_at?: string
          human_on_complaint?: boolean
          human_when_unsure?: boolean
          id?: string
          knowledge_text?: string
          tone?: string
          updated_at?: string
          use_manual_pix_fallback?: boolean
        }
        Update: {
          accepts_audio?: boolean
          allow_after_hours?: boolean
          allow_paid_apps_info?: boolean
          answer_length?: string
          auto_offer_trial?: boolean
          company_id?: string
          created_at?: string
          human_on_complaint?: boolean
          human_when_unsure?: boolean
          id?: string
          knowledge_text?: string
          tone?: string
          updated_at?: string
          use_manual_pix_fallback?: boolean
        }
        Relationships: []
      }
      company_ai_payment_settings: {
        Row: {
          company_id: string
          created_at: string
          id: string
          manual_pix_bank: string | null
          manual_pix_holder: string | null
          manual_pix_key: string | null
          payment_note: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          manual_pix_bank?: string | null
          manual_pix_holder?: string | null
          manual_pix_key?: string | null
          payment_note?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          manual_pix_bank?: string | null
          manual_pix_holder?: string | null
          manual_pix_key?: string | null
          payment_note?: string | null
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
      credential_access_log: {
        Row: {
          action: string
          company_id: string
          created_at: string
          id: string
          target_id: string
          target_kind: string
          user_id: string | null
        }
        Insert: {
          action: string
          company_id: string
          created_at?: string
          id?: string
          target_id: string
          target_kind: string
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          id?: string
          target_id?: string
          target_kind?: string
          user_id?: string | null
        }
        Relationships: []
      }
      customer_due_overrides: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          due_date: string
          id: string
          note: string | null
          source: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          due_date: string
          id?: string
          note?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          due_date?: string
          id?: string
          note?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_import_jobs: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          failed_rows: number
          filename: string | null
          id: string
          imported_rows: number
          mapping: Json
          status: string
          summary: Json
          total_rows: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          failed_rows?: number
          filename?: string | null
          id?: string
          imported_rows?: number
          mapping?: Json
          status?: string
          summary?: Json
          total_rows?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          failed_rows?: number
          filename?: string | null
          id?: string
          imported_rows?: number
          mapping?: Json
          status?: string
          summary?: Json
          total_rows?: number
          updated_at?: string
        }
        Relationships: []
      }
      customer_iptv_credentials: {
        Row: {
          app_used: string | null
          company_id: string
          created_at: string
          customer_id: string
          device_key: string | null
          expires_at: string | null
          extras: Json
          id: string
          iptv_password_enc: string | null
          iptv_username: string | null
          mac: string | null
          notes: string | null
          plan_days: number | null
          server_id: string | null
          updated_at: string
        }
        Insert: {
          app_used?: string | null
          company_id: string
          created_at?: string
          customer_id: string
          device_key?: string | null
          expires_at?: string | null
          extras?: Json
          id?: string
          iptv_password_enc?: string | null
          iptv_username?: string | null
          mac?: string | null
          notes?: string | null
          plan_days?: number | null
          server_id?: string | null
          updated_at?: string
        }
        Update: {
          app_used?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string
          device_key?: string | null
          expires_at?: string | null
          extras?: Json
          id?: string
          iptv_password_enc?: string | null
          iptv_username?: string | null
          mac?: string | null
          notes?: string | null
          plan_days?: number | null
          server_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      customer_portal_devices: {
        Row: {
          company_id: string
          created_at: string
          current_route: string | null
          customer_id: string
          device_key: string | null
          id: string
          last_updated_at: string | null
          mac: string | null
          notes: string | null
          portal_app_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          current_route?: string | null
          customer_id: string
          device_key?: string | null
          id?: string
          last_updated_at?: string | null
          mac?: string | null
          notes?: string | null
          portal_app_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          current_route?: string | null
          customer_id?: string
          device_key?: string | null
          id?: string
          last_updated_at?: string | null
          mac?: string | null
          notes?: string | null
          portal_app_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_referrals: {
        Row: {
          closed_at: string | null
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          payload: Json
          referred_customer_id: string | null
          referred_name: string | null
          referred_phone: string | null
          referrer_customer_id: string | null
          referrer_name: string | null
          referrer_phone: string | null
          reward_applied_at: string | null
          reward_status: string
          status: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          payload?: Json
          referred_customer_id?: string | null
          referred_name?: string | null
          referred_phone?: string | null
          referrer_customer_id?: string | null
          referrer_name?: string | null
          referrer_phone?: string | null
          reward_applied_at?: string | null
          reward_status?: string
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          payload?: Json
          referred_customer_id?: string | null
          referred_name?: string | null
          referred_phone?: string | null
          referrer_customer_id?: string | null
          referrer_name?: string | null
          referrer_phone?: string | null
          reward_applied_at?: string | null
          reward_status?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_service_plan: {
        Row: {
          company_id: string
          customer_id: string
          service_plan_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          customer_id: string
          service_plan_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          customer_id?: string
          service_plan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_service_plan_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_service_plan_service_plan_id_fkey"
            columns: ["service_plan_id"]
            isOneToOne: false
            referencedRelation: "service_plans"
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
          amount_cents: number
          company_id: string
          created_at: string
          document: string | null
          due_date: string | null
          due_day: number | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          price_group_id: string | null
          referral_customer_id: string | null
          referral_raw: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          company_id: string
          created_at?: string
          document?: string | null
          due_date?: string | null
          due_day?: number | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          price_group_id?: string | null
          referral_customer_id?: string | null
          referral_raw?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          company_id?: string
          created_at?: string
          document?: string | null
          due_date?: string | null
          due_day?: number | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          price_group_id?: string | null
          referral_customer_id?: string | null
          referral_raw?: string | null
          status?: string
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
      dns_domains: {
        Row: {
          archived: boolean
          company_id: string
          created_at: string
          domain: string
          id: string
          notes: string | null
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          company_id: string
          created_at?: string
          domain: string
          id?: string
          notes?: string | null
          provider?: string
          status?: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          company_id?: string
          created_at?: string
          domain?: string
          id?: string
          notes?: string | null
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      dns_routes: {
        Row: {
          archived: boolean
          company_id: string
          created_at: string
          destination: string
          domain_id: string
          environment: string
          host: string
          id: string
          is_active: boolean
          is_backup: boolean
          is_primary: boolean
          notes: string | null
          previous_value: string | null
          record_type: string
          server_id: string | null
          status: string
          subdomain: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          company_id: string
          created_at?: string
          destination?: string
          domain_id: string
          environment?: string
          host: string
          id?: string
          is_active?: boolean
          is_backup?: boolean
          is_primary?: boolean
          notes?: string | null
          previous_value?: string | null
          record_type?: string
          server_id?: string | null
          status?: string
          subdomain?: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          company_id?: string
          created_at?: string
          destination?: string
          domain_id?: string
          environment?: string
          host?: string
          id?: string
          is_active?: boolean
          is_backup?: boolean
          is_primary?: boolean
          notes?: string | null
          previous_value?: string | null
          record_type?: string
          server_id?: string | null
          status?: string
          subdomain?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dns_routes_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "dns_domains"
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
      imported_customer_due_dates: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string | null
          customer_name: string | null
          due_date: string
          id: string
          phone: string | null
          raw_row: Json
          source_job_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          due_date: string
          id?: string
          phone?: string | null
          raw_row?: Json
          source_job_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          due_date?: string
          id?: string
          phone?: string | null
          raw_row?: Json
          source_job_id?: string | null
        }
        Relationships: []
      }
      manual_dispatch_rules: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          days_offset: number
          id: string
          is_active: boolean
          name: string
          priority: string
          rule_key: string
          rule_type: string
          settings: Json
          template: string
          tone: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          days_offset?: number
          id?: string
          is_active?: boolean
          name: string
          priority?: string
          rule_key: string
          rule_type?: string
          settings?: Json
          template?: string
          tone?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          days_offset?: number
          id?: string
          is_active?: boolean
          name?: string
          priority?: string
          rule_key?: string
          rule_type?: string
          settings?: Json
          template?: string
          tone?: string
          updated_at?: string
        }
        Relationships: []
      }
      manual_renewals: {
        Row: {
          amount_cents: number | null
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          months_added: number | null
          new_due_date: string
          note: string | null
          old_due_date: string | null
          payload: Json
          payment_method: string | null
          service_plan_id: string | null
        }
        Insert: {
          amount_cents?: number | null
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          months_added?: number | null
          new_due_date: string
          note?: string | null
          old_due_date?: string | null
          payload?: Json
          payment_method?: string | null
          service_plan_id?: string | null
        }
        Update: {
          amount_cents?: number | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          months_added?: number | null
          new_due_date?: string
          note?: string | null
          old_due_date?: string | null
          payload?: Json
          payment_method?: string | null
          service_plan_id?: string | null
        }
        Relationships: []
      }
      marketplace_accounts: {
        Row: {
          access_token_enc: string | null
          company_id: string
          connected_at: string | null
          created_at: string
          disconnected_at: string | null
          expires_at: string | null
          id: string
          last_error: string | null
          live_mode: boolean
          mp_user_id: string | null
          provider: string
          public_key: string | null
          refresh_token_enc: string | null
          scope: string | null
          status: string
          updated_at: string
        }
        Insert: {
          access_token_enc?: string | null
          company_id: string
          connected_at?: string | null
          created_at?: string
          disconnected_at?: string | null
          expires_at?: string | null
          id?: string
          last_error?: string | null
          live_mode?: boolean
          mp_user_id?: string | null
          provider?: string
          public_key?: string | null
          refresh_token_enc?: string | null
          scope?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          access_token_enc?: string | null
          company_id?: string
          connected_at?: string | null
          created_at?: string
          disconnected_at?: string | null
          expires_at?: string | null
          id?: string
          last_error?: string | null
          live_mode?: boolean
          mp_user_id?: string | null
          provider?: string
          public_key?: string | null
          refresh_token_enc?: string | null
          scope?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      mercado_pago_webhook_events: {
        Row: {
          company_id: string | null
          error: string | null
          id: string
          mp_action: string | null
          mp_event_id: string | null
          mp_resource_id: string | null
          mp_topic: string | null
          mp_type: string | null
          processed_at: string | null
          raw_payload: Json | null
          received_at: string
          signature_valid: boolean | null
          status: string
          transaction_id: string | null
        }
        Insert: {
          company_id?: string | null
          error?: string | null
          id?: string
          mp_action?: string | null
          mp_event_id?: string | null
          mp_resource_id?: string | null
          mp_topic?: string | null
          mp_type?: string | null
          processed_at?: string | null
          raw_payload?: Json | null
          received_at?: string
          signature_valid?: boolean | null
          status?: string
          transaction_id?: string | null
        }
        Update: {
          company_id?: string | null
          error?: string | null
          id?: string
          mp_action?: string | null
          mp_event_id?: string | null
          mp_resource_id?: string | null
          mp_topic?: string | null
          mp_type?: string | null
          processed_at?: string | null
          raw_payload?: Json | null
          received_at?: string
          signature_valid?: boolean | null
          status?: string
          transaction_id?: string | null
        }
        Relationships: []
      }
      payment_settings: {
        Row: {
          company_id: string
          created_at: string
          fee_mode: string
          id: string
          is_active: boolean
          platform_fee_bps: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          fee_mode?: string
          id?: string
          is_active?: boolean
          platform_fee_bps?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          fee_mode?: string
          id?: string
          is_active?: boolean
          platform_fee_bps?: number
          updated_at?: string
        }
        Relationships: []
      }
      payment_split_logs: {
        Row: {
          application_fee_cents: number
          company_id: string
          created_at: string
          error: string | null
          id: string
          mp_response: Json | null
          owner_amount_cents: number
          status: string
          total_amount_cents: number
          transaction_id: string
        }
        Insert: {
          application_fee_cents?: number
          company_id: string
          created_at?: string
          error?: string | null
          id?: string
          mp_response?: Json | null
          owner_amount_cents?: number
          status?: string
          total_amount_cents?: number
          transaction_id: string
        }
        Update: {
          application_fee_cents?: number
          company_id?: string
          created_at?: string
          error?: string | null
          id?: string
          mp_response?: Json | null
          owner_amount_cents?: number
          status?: string
          total_amount_cents?: number
          transaction_id?: string
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount_cents: number
          company_id: string
          created_at: string
          customer_id: string | null
          description: string | null
          expires_at: string | null
          external_reference: string
          fee_mode: string
          id: string
          init_point: string | null
          mp_payment_id: string | null
          mp_preference_id: string | null
          paid_at: string | null
          payment_method: string
          processing_fee_cents: number
          qr_code: string | null
          qr_code_base64: string | null
          raw_response: Json | null
          status: string
          ticket_url: string | null
          total_amount_cents: number
          updated_at: string
        }
        Insert: {
          amount_cents: number
          company_id: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          expires_at?: string | null
          external_reference: string
          fee_mode?: string
          id?: string
          init_point?: string | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          paid_at?: string | null
          payment_method?: string
          processing_fee_cents?: number
          qr_code?: string | null
          qr_code_base64?: string | null
          raw_response?: Json | null
          status?: string
          ticket_url?: string | null
          total_amount_cents: number
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          company_id?: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          expires_at?: string | null
          external_reference?: string
          fee_mode?: string
          id?: string
          init_point?: string | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          paid_at?: string | null
          payment_method?: string
          processing_fee_cents?: number
          qr_code?: string | null
          qr_code_base64?: string | null
          raw_response?: Json | null
          status?: string
          ticket_url?: string | null
          total_amount_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      portal_apps: {
        Row: {
          app_name: string
          color: string
          company_id: string
          created_at: string
          id: string
          id_type: string
          is_active: boolean
          key_url_template: string | null
          mac_url_template: string | null
          notes: string | null
          panel_login: string | null
          panel_password_enc: string | null
          panel_url: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          app_name: string
          color?: string
          company_id: string
          created_at?: string
          id?: string
          id_type?: string
          is_active?: boolean
          key_url_template?: string | null
          mac_url_template?: string | null
          notes?: string | null
          panel_login?: string | null
          panel_password_enc?: string | null
          panel_url?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          app_name?: string
          color?: string
          company_id?: string
          created_at?: string
          id?: string
          id_type?: string
          is_active?: boolean
          key_url_template?: string | null
          mac_url_template?: string | null
          notes?: string | null
          panel_login?: string | null
          panel_password_enc?: string | null
          panel_url?: string | null
          sort_order?: number
          updated_at?: string
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
      renewal_tasks: {
        Row: {
          assigned_to: string | null
          attempts: number
          company_id: string
          completed_at: string | null
          created_at: string
          credential_id: string | null
          customer_id: string
          id: string
          kind: string
          last_error: string | null
          notes: string | null
          plan_days: number | null
          screenshot_url: string | null
          server_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          attempts?: number
          company_id: string
          completed_at?: string | null
          created_at?: string
          credential_id?: string | null
          customer_id: string
          id?: string
          kind?: string
          last_error?: string | null
          notes?: string | null
          plan_days?: number | null
          screenshot_url?: string | null
          server_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          attempts?: number
          company_id?: string
          completed_at?: string | null
          created_at?: string
          credential_id?: string | null
          customer_id?: string
          id?: string
          kind?: string
          last_error?: string | null
          notes?: string | null
          plan_days?: number | null
          screenshot_url?: string | null
          server_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "renewal_tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewal_tasks_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "customer_iptv_credentials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewal_tasks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewal_tasks_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_checkout_sessions: {
        Row: {
          amount_cents: number
          company_id: string
          created_at: string
          external_reference: string
          id: string
          init_point: string | null
          mp_payment_id: string | null
          paid_at: string | null
          plan_id: string
          preference_id: string | null
          raw_response: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          company_id: string
          created_at?: string
          external_reference: string
          id?: string
          init_point?: string | null
          mp_payment_id?: string | null
          paid_at?: string | null
          plan_id: string
          preference_id?: string | null
          raw_response?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          company_id?: string
          created_at?: string
          external_reference?: string
          id?: string
          init_point?: string | null
          mp_payment_id?: string | null
          paid_at?: string | null
          plan_id?: string
          preference_id?: string | null
          raw_response?: Json | null
          status?: string
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
      servers: {
        Row: {
          color: string
          company_id: string
          created_at: string
          customer_search_url_template: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          panel_password_enc: string | null
          panel_type: string
          panel_url: string | null
          panel_username: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          company_id: string
          created_at?: string
          customer_search_url_template?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          panel_password_enc?: string | null
          panel_type?: string
          panel_url?: string | null
          panel_username?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          company_id?: string
          created_at?: string
          customer_search_url_template?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          panel_password_enc?: string | null
          panel_type?: string
          panel_url?: string | null
          panel_username?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      service_message_dispatch_log: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string
          cycle_key: string
          dispatch_type: string
          error: string | null
          id: string
          message_body: string | null
          queue_id: string | null
          sent_at: string | null
          service_plan_id: string
          service_plan_message_id: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id: string
          cycle_key: string
          dispatch_type?: string
          error?: string | null
          id?: string
          message_body?: string | null
          queue_id?: string | null
          sent_at?: string | null
          service_plan_id: string
          service_plan_message_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string
          cycle_key?: string
          dispatch_type?: string
          error?: string | null
          id?: string
          message_body?: string | null
          queue_id?: string | null
          sent_at?: string | null
          service_plan_id?: string
          service_plan_message_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_plan_messages: {
        Row: {
          company_id: string
          created_at: string
          id: string
          kind: string
          label: string
          offset_days: number
          service_plan_id: string
          template: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          kind: string
          label: string
          offset_days?: number
          service_plan_id: string
          template: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          kind?: string
          label?: string
          offset_days?: number
          service_plan_id?: string
          template?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_plan_messages_service_plan_id_fkey"
            columns: ["service_plan_id"]
            isOneToOne: false
            referencedRelation: "service_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      service_plans: {
        Row: {
          ativo: boolean
          company_id: string
          created_at: string
          id: string
          meses: number
          nome: string
          preco_cents: number
          telas: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          company_id: string
          created_at?: string
          id?: string
          meses?: number
          nome: string
          preco_cents?: number
          telas?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          company_id?: string
          created_at?: string
          id?: string
          meses?: number
          nome?: string
          preco_cents?: number
          telas?: number
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
      activate_saas_subscription: {
        Args: { _company_id: string; _period_days?: number; _plan_id: string }
        Returns: undefined
      }
      archive_customer_admin: {
        Args: { p_customer_id: string }
        Returns: undefined
      }
      claim_super_admin_bootstrap: { Args: never; Returns: Json }
      claim_whatsapp_queue_batch: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          body: string
          company_id: string
          id: string
          instance_id: string
          max_attempts: number
          to_phone: string
        }[]
      }
      cleanup_auth_ephemeral: { Args: never; Returns: undefined }
      create_customer_admin: {
        Args: {
          p_amount_cents?: number
          p_company_id: string
          p_due_day?: number
          p_name: string
          p_notes?: string
          p_whatsapp_e164: string
        }
        Returns: string
      }
      current_user_is_super_admin: { Args: never; Returns: boolean }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_user_default_company: { Args: never; Returns: string }
      get_customer_details_admin: {
        Args: { p_customer_id: string }
        Returns: Json
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
      list_customers_admin: {
        Args: {
          p_company_id: string
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_status?: string
        }
        Returns: Json
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      reactivate_customer_admin: {
        Args: { p_customer_id: string }
        Returns: undefined
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      renew_customer_admin: {
        Args: {
          p_amount_cents?: number
          p_customer_id: string
          p_due_date: string
          p_notes?: string
        }
        Returns: Json
      }
      set_vault_secret: {
        Args: { p_name: string; p_value: string }
        Returns: undefined
      }
      update_customer_admin: {
        Args: {
          p_amount_cents?: number
          p_customer_id: string
          p_due_day?: number
          p_name?: string
          p_notes?: string
          p_status?: string
          p_whatsapp_e164?: string
        }
        Returns: Json
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
