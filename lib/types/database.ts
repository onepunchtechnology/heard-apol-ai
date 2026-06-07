export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      stores: {
        Row: {
          id: string
          user_id: string
          store_domain: string
          shopify_domain: string | null
          store_name: string | null
          platform: 'shopify' | 'woocommerce' | 'bigcommerce' | 'custom' | null
          platform_access_token: string | null
          platform_api_secret: string | null
          platform_config: Json | null
          judgeme_api_token: string | null
          judgeme_oauth_client_id: string | null
          judgeme_oauth_client_secret: string | null
          judgeme_webhook_secret: string | null
          google_oauth_tokens: Json | null
          google_location_name: string | null
          google_connection_mode: 'api' | 'manual_paste' | null
          reply_mode: 'auto_post' | 'manual_approval'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          store_domain: string
          shopify_domain?: string | null
          store_name?: string | null
          platform?: 'shopify' | 'woocommerce' | 'bigcommerce' | 'custom' | null
          platform_access_token?: string | null
          platform_api_secret?: string | null
          platform_config?: Json | null
          judgeme_api_token?: string | null
          judgeme_oauth_client_id?: string | null
          judgeme_oauth_client_secret?: string | null
          judgeme_webhook_secret?: string | null
          google_oauth_tokens?: Json | null
          google_location_name?: string | null
          google_connection_mode?: 'api' | 'manual_paste' | null
          reply_mode?: 'auto_post' | 'manual_approval'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          store_domain?: string
          shopify_domain?: string | null
          store_name?: string | null
          platform?: 'shopify' | 'woocommerce' | 'bigcommerce' | 'custom' | null
          platform_access_token?: string | null
          platform_api_secret?: string | null
          platform_config?: Json | null
          judgeme_api_token?: string | null
          judgeme_oauth_client_id?: string | null
          judgeme_oauth_client_secret?: string | null
          judgeme_webhook_secret?: string | null
          google_oauth_tokens?: Json | null
          google_location_name?: string | null
          google_connection_mode?: 'api' | 'manual_paste' | null
          reply_mode?: 'auto_post' | 'manual_approval'
          created_at?: string
        }
        Relationships: []
      }
      brand_voice_config: {
        Row: {
          id: string
          store_id: string
          sample_replies: string[]
          rules: string[]
          tone_description: string | null
          tone_positive: string | null
          tone_negative: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          sample_replies?: string[]
          rules?: string[]
          tone_description?: string | null
          tone_positive?: string | null
          tone_negative?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          sample_replies?: string[]
          rules?: string[]
          tone_description?: string | null
          tone_positive?: string | null
          tone_negative?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          id: string
          store_id: string
          external_id: string
          source: 'judgeme' | 'google_business'
          reviewer_name: string
          rating: number
          title: string | null
          body: string
          product_title: string | null
          product_handle: string | null
          order_id: string | null
          status: 'pending' | 'processing' | 'auto_posted' | 'needs_review' | 'reply_pending_manual' | 'failed' | 'approved' | 'rejected'
          received_at: string
          raw_payload: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          external_id: string
          source: 'judgeme' | 'google_business'
          reviewer_name: string
          rating: number
          title?: string | null
          body: string
          product_title?: string | null
          product_handle?: string | null
          order_id?: string | null
          status?: 'pending' | 'processing' | 'auto_posted' | 'needs_review' | 'reply_pending_manual' | 'failed' | 'approved' | 'rejected'
          received_at?: string
          raw_payload?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          external_id?: string
          source?: 'judgeme' | 'google_business'
          reviewer_name?: string
          rating?: number
          title?: string | null
          body?: string
          product_title?: string | null
          product_handle?: string | null
          order_id?: string | null
          status?: 'pending' | 'processing' | 'auto_posted' | 'needs_review' | 'reply_pending_manual' | 'failed' | 'approved' | 'rejected'
          received_at?: string
          raw_payload?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      review_actions: {
        Row: {
          id: string
          review_id: string
          sentiment_score: number | null
          sentiment_label: 'positive' | 'neutral' | 'negative' | null
          category: 'praise' | 'question' | 'complaint' | 'urgent' | null
          risk_score: number | null
          risk_flags: string[]
          key_themes: string[]
          agent_reasoning: string | null
          agent_trace: Json | null
          draft_reply: string | null
          final_reply: string | null
          order_context: Json | null
          confidence: number | null
          decision: 'auto_post' | 'escalate' | null
          auto_posted_at: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          review_id: string
          sentiment_score?: number | null
          sentiment_label?: 'positive' | 'neutral' | 'negative' | null
          category?: 'praise' | 'question' | 'complaint' | 'urgent' | null
          risk_score?: number | null
          risk_flags?: string[]
          key_themes?: string[]
          agent_reasoning?: string | null
          agent_trace?: Json | null
          draft_reply?: string | null
          final_reply?: string | null
          order_context?: Json | null
          confidence?: number | null
          decision?: 'auto_post' | 'escalate' | null
          auto_posted_at?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          review_id?: string
          sentiment_score?: number | null
          sentiment_label?: 'positive' | 'neutral' | 'negative' | null
          category?: 'praise' | 'question' | 'complaint' | 'urgent' | null
          risk_score?: number | null
          risk_flags?: string[]
          key_themes?: string[]
          agent_reasoning?: string | null
          agent_trace?: Json | null
          draft_reply?: string | null
          final_reply?: string | null
          order_context?: Json | null
          confidence?: number | null
          decision?: 'auto_post' | 'escalate' | null
          auto_posted_at?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      agent_runs: {
        Row: {
          id: string
          store_id: string
          trigger_type: 'webhook' | 'manual' | 'scheduled'
          review_ids: string[]
          started_at: string
          completed_at: string | null
          reviews_processed: number
          auto_posted: number
          escalated: number
          failed: number
          error_details: Json | null
        }
        Insert: {
          id?: string
          store_id: string
          trigger_type: 'webhook' | 'manual' | 'scheduled'
          review_ids?: string[]
          started_at?: string
          completed_at?: string | null
          reviews_processed?: number
          auto_posted?: number
          escalated?: number
          failed?: number
          error_details?: Json | null
        }
        Update: {
          id?: string
          store_id?: string
          trigger_type?: 'webhook' | 'manual' | 'scheduled'
          review_ids?: string[]
          started_at?: string
          completed_at?: string | null
          reviews_processed?: number
          auto_posted?: number
          escalated?: number
          failed?: number
          error_details?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
