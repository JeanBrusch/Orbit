export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      leads: {
        Row: {
          id: string;
          name: string | null;
          phone: string | null;
          photo_url: string | null;
          origin: string | null;
          state: string | null;
          action_suggested: string | null;
          last_event_type: string | null;
          last_interaction_at: string | null;
          last_evaluated_at: string | null;
          created_at: string | null;
          orbit_stage: string | null;
          orbit_visual_state: string | null;
          last_decision_at: string | null;
          lid: string | null;
          public_token: string | null;
          semantic_vector: number[] | null;
        };
        Insert: {
          id?: string;
          name?: string | null;
          phone?: string | null;
          photo_url?: string | null;
          origin?: string | null;
          state?: string | null;
          action_suggested?: string | null;
          last_event_type?: string | null;
          last_interaction_at?: string | null;
          last_evaluated_at?: string | null;
          created_at?: string | null;
          orbit_stage?: string | null;
          orbit_visual_state?: string | null;
          last_decision_at?: string | null;
          lid?: string | null;
          public_token?: string | null;
          semantic_vector?: number[] | null;
        };
        Update: {
          id?: string;
          name?: string | null;
          phone?: string | null;
          photo_url?: string | null;
          origin?: string | null;
          state?: string | null;
          action_suggested?: string | null;
          last_event_type?: string | null;
          last_interaction_at?: string | null;
          last_evaluated_at?: string | null;
          created_at?: string | null;
          orbit_stage?: string | null;
          orbit_visual_state?: string | null;
          last_decision_at?: string | null;
          lid?: string | null;
          public_token?: string | null;
          semantic_vector?: number[] | null;
        };
      };
      // ─── NEW: messages (replaces interactions) ───────────────────────────────
      messages: {
        Row: {
          id: string;
          lead_id: string | null;
          source: 'whatsapp' | 'operator';
          content: string | null;
          timestamp: string;
          ai_analysis: Json | null;
          idempotency_key: string | null;
          embedding: number[] | null;
        };
        Insert: {
          id?: string;
          lead_id?: string | null;
          source: 'whatsapp' | 'operator';
          content?: string | null;
          timestamp?: string;
          ai_analysis?: Json | null;
          idempotency_key?: string | null;
          embedding?: number[] | null;
        };
        Update: {
          id?: string;
          lead_id?: string | null;
          source?: 'whatsapp' | 'operator';
          content?: string | null;
          timestamp?: string;
          ai_analysis?: Json | null;
          idempotency_key?: string | null;
          embedding?: number[] | null;
        };
      };
      // ─── NEW: property_interactions (replaces capsule_items) ─────────────────
      property_interactions: {
        Row: {
          id: string;
          lead_id: string | null;
          property_id: string | null;
          interaction_type: 'sent' | 'favorited' | 'visited' | 'discarded' | 'proposal';
          timestamp: string;
          source: string | null;
        };
        Insert: {
          id?: string;
          lead_id?: string | null;
          property_id?: string | null;
          interaction_type: 'sent' | 'favorited' | 'visited' | 'discarded' | 'proposal';
          timestamp?: string;
          source?: string | null;
        };
        Update: {
          id?: string;
          lead_id?: string | null;
          property_id?: string | null;
          interaction_type?: 'sent' | 'favorited' | 'visited' | 'discarded' | 'proposal';
          timestamp?: string;
          source?: string | null;
        };
      };
      // ─── UPDATED: lead_cognitive_state (added current_state) ─────────────────
      lead_cognitive_state: {
        Row: {
          lead_id: string;
          interest_score: number;
          momentum_score: number;
          risk_score: number;
          clarity_level: number;
          current_state: 'latent' | 'curious' | 'exploring' | 'evaluating' | 'deciding' | 'resolved' | 'dormant';
          last_human_action_at: string | null;
          last_ai_analysis_at: string | null;
        };
        Insert: {
          lead_id: string;
          interest_score?: number;
          momentum_score?: number;
          risk_score?: number;
          clarity_level?: number;
          current_state?: 'latent' | 'curious' | 'exploring' | 'evaluating' | 'deciding' | 'resolved' | 'dormant';
          last_human_action_at?: string | null;
          last_ai_analysis_at?: string | null;
        };
        Update: {
          lead_id?: string;
          interest_score?: number;
          momentum_score?: number;
          risk_score?: number;
          clarity_level?: number;
          current_state?: 'latent' | 'curious' | 'exploring' | 'evaluating' | 'deciding' | 'resolved' | 'dormant';
          last_human_action_at?: string | null;
          last_ai_analysis_at?: string | null;
        };
      };
      ai_insights: {
        Row: {
          id: string;
          lead_id: string;
          type: string;
          content: string;
          urgency: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          lead_id: string;
          type: string;
          content: string;
          urgency: number;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          lead_id?: string;
          type?: string;
          content?: string;
          urgency?: number;
          created_at?: string | null;
        };
      };
      // ─── UPDATED: memory_items (added source_message_id, expanded types) ─────
      memory_items: {
        Row: {
          id: string;
          lead_id: string;
          type: 'intent' | 'preference' | 'budget' | 'constraint' | 'pain' | 'event' | 'objection' | 'identity' | 'budget_range' | 'location_preference' | 'property_type' | 'feature_preference' | 'current_search' | 'location_focus' | 'priority' | 'property_sent' | 'visited' | 'discarded' | 'price_objection' | 'proposal_made' | 'visit_scheduled';
          content: string;
          confidence: number | null;
          created_at: string | null;
          source_message_id: string | null;
        };
        Insert: {
          id?: string;
          lead_id: string;
          type: 'intent' | 'preference' | 'budget' | 'constraint' | 'pain' | 'event' | 'objection' | 'identity' | 'budget_range' | 'location_preference' | 'property_type' | 'feature_preference' | 'current_search' | 'location_focus' | 'priority' | 'property_sent' | 'visited' | 'discarded' | 'price_objection' | 'proposal_made' | 'visit_scheduled';
          content: string;
          confidence?: number | null;
          created_at?: string | null;
          source_message_id?: string | null;
        };
        Update: {
          id?: string;
          lead_id?: string;
          type?: 'identity' | 'budget_range' | 'location_preference' | 'property_type' | 'feature_preference' | 'current_search' | 'location_focus' | 'budget' | 'priority' | 'property_sent' | 'visited' | 'discarded' | 'price_objection' | 'proposal_made' | 'visit_scheduled' | 'intent' | 'preference' | 'constraint' | 'pain' | 'event' | 'objection';
          content?: string;
          confidence?: number | null;
          created_at?: string | null;
          source_message_id?: string | null;
        };
      };
      // ─── LEGACY: interactions (kept for backward compat, not written to) ─────
      interactions: {
        Row: {
          id: string;
          lead_id: string | null;
          type: string;
          direction: string | null;
          content: string | null;
          created_at: string | null;
          idempotency_key: string | null;
        };
        Insert: {
          id?: string;
          lead_id?: string | null;
          type: string;
          direction?: string | null;
          content?: string | null;
          created_at?: string | null;
          idempotency_key?: string | null;
        };
        Update: {
          id?: string;
          lead_id?: string | null;
          type?: string;
          direction?: string | null;
          content?: string | null;
          created_at?: string | null;
          idempotency_key?: string | null;
        };
      };
      properties: {
        Row: {
          id: string;
          source_link: string;
          internal_name: string | null;
          title: string | null;
          cover_image: string | null;
          source_domain: string | null;
          ingestion_type: string | null;
          ingestion_status: string | null;
          lat: number | null;
          lng: number | null;
          location_status: string | null;
          visibility: string | null;
          created_at: string | null;
          value: number | null;
          location_text: string | null;
          neighborhood: string | null;
          city: string | null;
          area_privativa: number | null;
          bedrooms: number | null;
          suites: number | null;
          parking_spots: number | null;
          payment_conditions: Json | null;
          condo_fee: number | null;
          iptu: number | null;
          features: string[] | null;
          property_embedding: number[] | null;
        };
        Insert: {
          id?: string;
          source_link: string;
          internal_name?: string | null;
          title?: string | null;
          cover_image?: string | null;
          source_domain?: string | null;
          ingestion_type?: string | null;
          ingestion_status?: string | null;
          lat?: number | null;
          lng?: number | null;
          location_status?: string | null;
          visibility?: string | null;
          created_at?: string | null;
          value?: number | null;
          location_text?: string | null;
        };
        Update: {
          id?: string;
          source_link?: string;
          internal_name?: string | null;
          title?: string | null;
          cover_image?: string | null;
          source_domain?: string | null;
          ingestion_type?: string | null;
          ingestion_status?: string | null;
          lat?: number | null;
          lng?: number | null;
          location_status?: string | null;
          visibility?: string | null;
          created_at?: string | null;
          value?: number | null;
          location_text?: string | null;
          neighborhood?: string | null;
          city?: string | null;
          area_privativa?: number | null;
          bedrooms?: number | null;
          suites?: number | null;
          parking_spots?: number | null;
          payment_conditions?: Json | null;
          condo_fee?: number | null;
          iptu?: number | null;
          features?: string[] | null;
          property_embedding?: number[] | null;
        };
      };
      reminders: {
        Row: {
          id: string;
          lead_id: string | null;
          due_at: string;
          type: string | null;
          status: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          lead_id?: string | null;
          due_at: string;
          type?: string | null;
          status?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          lead_id?: string | null;
          due_at?: string;
          type?: string | null;
          status?: string | null;
          created_at?: string | null;
        };
      };
      internal_notes: {
        Row: {
          id: string;
          lead_id: string | null;
          capsule_id: string | null;
          content: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          lead_id?: string | null;
          capsule_id?: string | null;
          content: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          lead_id?: string | null;
          capsule_id?: string | null;
          content?: string;
          created_at?: string | null;
        };
      };
      app_users: {
        Row: {
          id: string;
          email: string;
          password_hash: string;
          name: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          email: string;
          password_hash: string;
          name?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          password_hash?: string;
          name?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      leads_center: {
        Row: {
          lead_id: string | null;
          name: string | null;
          phone: string | null;
          photo_url: string | null;
          origin: string | null;
          estado_atual: string | null;
          acao_sugerida: string | null;
          last_event_type: string | null;
          ultima_interacao_at: string | null;
          dias_sem_interacao: number | null;
          tem_capsula_ativa: boolean | null;
          last_evaluated_at: string | null;
          created_at: string | null;
        };
        Insert: {
          lead_id?: string | null;
          name?: string | null;
          phone?: string | null;
          photo_url?: string | null;
          origin?: string | null;
          estado_atual?: string | null;
          acao_sugerida?: string | null;
          last_event_type?: string | null;
          ultima_interacao_at?: string | null;
          dias_sem_interacao?: number | null;
          tem_capsula_ativa?: boolean | null;
          last_evaluated_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          lead_id?: string | null;
          name?: string | null;
          phone?: string | null;
          photo_url?: string | null;
          origin?: string | null;
          estado_atual?: string | null;
          acao_sugerida?: string | null;
          last_event_type?: string | null;
          ultima_interacao_at?: string | null;
          dias_sem_interacao?: number | null;
          tem_capsula_ativa?: boolean | null;
          last_evaluated_at?: string | null;
          created_at?: string | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
