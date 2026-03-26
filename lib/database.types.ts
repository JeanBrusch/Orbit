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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_insights: {
        Row: {
          content: string
          created_at: string | null
          id: string
          lead_id: string
          type: string
          urgency: number
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          lead_id: string
          type: string
          urgency: number
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          lead_id?: string
          type?: string
          urgency?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_insights_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_center"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      app_users: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          name: string | null
          password_hash: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          name?: string | null
          password_hash?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          password_hash?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      bkp_leads_center: {
        Row: {
          acao_sugerida: string | null
          created_at: string | null
          dias_sem_interacao: number | null
          estado_atual: string | null
          last_evaluated_at: string | null
          last_event_type: string | null
          lead_id: string | null
          name: string | null
          origin: string | null
          phone: string | null
          photo_url: string | null
          tem_capsula_ativa: boolean | null
          ultima_interacao_at: string | null
        }
        Insert: {
          acao_sugerida?: string | null
          created_at?: string | null
          dias_sem_interacao?: number | null
          estado_atual?: string | null
          last_evaluated_at?: string | null
          last_event_type?: string | null
          lead_id?: string | null
          name?: string | null
          origin?: string | null
          phone?: string | null
          photo_url?: string | null
          tem_capsula_ativa?: boolean | null
          ultima_interacao_at?: string | null
        }
        Update: {
          acao_sugerida?: string | null
          created_at?: string | null
          dias_sem_interacao?: number | null
          estado_atual?: string | null
          last_evaluated_at?: string | null
          last_event_type?: string | null
          lead_id?: string | null
          name?: string | null
          origin?: string | null
          phone?: string | null
          photo_url?: string | null
          tem_capsula_ativa?: boolean | null
          ultima_interacao_at?: string | null
        }
        Relationships: []
      }
      capsule_embeddings: {
        Row: {
          capsule_item_id: string
          created_at: string | null
          embedding: string | null
          id: string
          model: string | null
        }
        Insert: {
          capsule_item_id: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          model?: string | null
        }
        Update: {
          capsule_item_id?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          model?: string | null
        }
        Relationships: []
      }
      capsule_items: {
        Row: {
          capsule_id: string | null
          content: string | null
          created_at: string | null
          id: string
          lead_id: string | null
          notes: string | null
          position: number | null
          property_id: string | null
          state: string | null
          type: string | null
        }
        Insert: {
          capsule_id?: string | null
          content?: string | null
          created_at?: string | null
          id: string
          lead_id?: string | null
          notes?: string | null
          position?: number | null
          property_id?: string | null
          state?: string | null
          type?: string | null
        }
        Update: {
          capsule_id?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          position?: number | null
          property_id?: string | null
          state?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_capsule_items_lead"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_capsule_items_lead"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_center"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "fk_capsule_items_property"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      capsules: {
        Row: {
          closed_at: string | null
          context: string | null
          id: string | null
          lead_id: string | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          closed_at?: string | null
          context?: string | null
          id?: string | null
          lead_id?: string | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          closed_at?: string | null
          context?: string | null
          id?: string | null
          lead_id?: string | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      client_property_context: {
        Row: {
          audio_url: string | null
          client_space_id: string | null
          created_at: string | null
          highlight_level: number | null
          id: string
          note: string | null
          property_id: string | null
          recommended_reason: string | null
          video_url: string | null
        }
        Insert: {
          audio_url?: string | null
          client_space_id?: string | null
          created_at?: string | null
          highlight_level?: number | null
          id?: string
          note?: string | null
          property_id?: string | null
          recommended_reason?: string | null
          video_url?: string | null
        }
        Update: {
          audio_url?: string | null
          client_space_id?: string | null
          created_at?: string | null
          highlight_level?: number | null
          id?: string
          note?: string | null
          property_id?: string | null
          recommended_reason?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_property_context_client_space_id_fkey"
            columns: ["client_space_id"]
            isOneToOne: false
            referencedRelation: "client_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_property_context_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      client_spaces: {
        Row: {
          access_token: string | null
          created_at: string | null
          id: string
          lead_id: string | null
          slug: string
          theme: string | null
          theme_config: Json | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          access_token?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string | null
          slug: string
          theme?: string | null
          theme_config?: Json | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string | null
          slug?: string
          theme?: string | null
          theme_config?: Json | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_spaces_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_spaces_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_center"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      cold_leads: {
        Row: {
          accessed_property_id: string | null
          created_at: string | null
          generated_message: string | null
          id: string
          last_contact_at: string | null
          name: string | null
          phone: string
          similar_properties_ids: string[] | null
          similarity_score: number | null
          status: string | null
        }
        Insert: {
          accessed_property_id?: string | null
          created_at?: string | null
          generated_message?: string | null
          id?: string
          last_contact_at?: string | null
          name?: string | null
          phone: string
          similar_properties_ids?: string[] | null
          similarity_score?: number | null
          status?: string | null
        }
        Update: {
          accessed_property_id?: string | null
          created_at?: string | null
          generated_message?: string | null
          id?: string
          last_contact_at?: string | null
          name?: string | null
          phone?: string
          similar_properties_ids?: string[] | null
          similarity_score?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cold_leads_accessed_property_id_fkey"
            columns: ["accessed_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_notes: {
        Row: {
          capsule_id: string | null
          content: string
          created_at: string | null
          id: string
          lead_id: string | null
        }
        Insert: {
          capsule_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          lead_id?: string | null
        }
        Update: {
          capsule_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          lead_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_notes_lead_id_fkey1"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_notes_lead_id_fkey1"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_center"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      lead_cognitive_state: {
        Row: {
          central_conflict: string | null
          clarity_level: number
          current_state: string | null
          interest_score: number
          last_ai_analysis_at: string | null
          last_human_action_at: string | null
          lead_id: string
          momentum_score: number
          risk_score: number
          what_not_to_do: string | null
        }
        Insert: {
          central_conflict?: string | null
          clarity_level?: number
          current_state?: string | null
          interest_score?: number
          last_ai_analysis_at?: string | null
          last_human_action_at?: string | null
          lead_id: string
          momentum_score?: number
          risk_score?: number
          what_not_to_do?: string | null
        }
        Update: {
          central_conflict?: string | null
          clarity_level?: number
          current_state?: string | null
          interest_score?: number
          last_ai_analysis_at?: string | null
          last_human_action_at?: string | null
          lead_id?: string
          momentum_score?: number
          risk_score?: number
          what_not_to_do?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_cognitive_state_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_cognitive_state_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads_center"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      lead_preferences: {
        Row: {
          confidence_score: number | null
          lead_id: string
          preferred_area: string | null
          preferred_features: string[] | null
          preferred_price_range: Json | null
          preferred_property_type: string | null
          updated_at: string | null
        }
        Insert: {
          confidence_score?: number | null
          lead_id: string
          preferred_area?: string | null
          preferred_features?: string[] | null
          preferred_price_range?: Json | null
          preferred_property_type?: string | null
          updated_at?: string | null
        }
        Update: {
          confidence_score?: number | null
          lead_id?: string
          preferred_area?: string | null
          preferred_features?: string[] | null
          preferred_price_range?: Json | null
          preferred_property_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_preferences_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_preferences_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads_center"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      leads: {
        Row: {
          action_suggested: string | null
          created_at: string | null
          cycle_stage: string | null
          followup_active: boolean | null
          followup_last_action_at: string | null
          followup_remaining: number | null
          followup_total: number | null
          id: string
          last_decision_at: string | null
          last_evaluated_at: string | null
          last_event_type: string | null
          last_interaction_at: string | null
          lid: string | null
          name: string | null
          orbit_stage: string | null
          orbit_visual_state: string | null
          origin: string | null
          phone: string
          photo_url: string | null
          public_token: string | null
          semantic_vector: string | null
          state: string | null
        }
        Insert: {
          action_suggested?: string | null
          created_at?: string | null
          cycle_stage?: string | null
          followup_active?: boolean | null
          followup_last_action_at?: string | null
          followup_remaining?: number | null
          followup_total?: number | null
          id?: string
          last_decision_at?: string | null
          last_evaluated_at?: string | null
          last_event_type?: string | null
          last_interaction_at?: string | null
          lid?: string | null
          name?: string | null
          orbit_stage?: string | null
          orbit_visual_state?: string | null
          origin?: string | null
          phone: string
          photo_url?: string | null
          public_token?: string | null
          semantic_vector?: string | null
          state?: string | null
        }
        Update: {
          action_suggested?: string | null
          created_at?: string | null
          cycle_stage?: string | null
          followup_active?: boolean | null
          followup_last_action_at?: string | null
          followup_remaining?: number | null
          followup_total?: number | null
          id?: string
          last_decision_at?: string | null
          last_evaluated_at?: string | null
          last_event_type?: string | null
          last_interaction_at?: string | null
          lid?: string | null
          name?: string | null
          orbit_stage?: string | null
          orbit_visual_state?: string | null
          origin?: string | null
          phone?: string
          photo_url?: string | null
          public_token?: string | null
          semantic_vector?: string | null
          state?: string | null
        }
        Relationships: []
      }
      memory_items: {
        Row: {
          confidence: number | null
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          lead_id: string
          source_message_id: string | null
          type: string
        }
        Insert: {
          confidence?: number | null
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          lead_id: string
          source_message_id?: string | null
          type: string
        }
        Update: {
          confidence?: number | null
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          lead_id?: string
          source_message_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_items_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_items_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_center"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "memory_items_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          ai_analysis: Json | null
          content: string | null
          embedding: string | null
          id: string
          idempotency_key: string | null
          lead_id: string | null
          source: string
          timestamp: string | null
        }
        Insert: {
          ai_analysis?: Json | null
          content?: string | null
          embedding?: string | null
          id?: string
          idempotency_key?: string | null
          lead_id?: string | null
          source: string
          timestamp?: string | null
        }
        Update: {
          ai_analysis?: Json | null
          content?: string | null
          embedding?: string | null
          id?: string
          idempotency_key?: string | null
          lead_id?: string | null
          source?: string
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_center"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      orbit_events: {
        Row: {
          action: string | null
          cost_usd: number | null
          destination: string | null
          duration_ms: number | null
          event_type: string
          has_ai: boolean | null
          id: string
          input_size: number | null
          lead_id: string | null
          metadata_json: Json | null
          module: string
          origin: string | null
          output_size: number | null
          saved_data: boolean | null
          source: string
          step: string | null
          timestamp: string
          tokens_input: number | null
          tokens_output: number | null
        }
        Insert: {
          action?: string | null
          cost_usd?: number | null
          destination?: string | null
          duration_ms?: number | null
          event_type: string
          has_ai?: boolean | null
          id?: string
          input_size?: number | null
          lead_id?: string | null
          metadata_json?: Json | null
          module: string
          origin?: string | null
          output_size?: number | null
          saved_data?: boolean | null
          source: string
          step?: string | null
          timestamp?: string
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Update: {
          action?: string | null
          cost_usd?: number | null
          destination?: string | null
          duration_ms?: number | null
          event_type?: string
          has_ai?: boolean | null
          id?: string
          input_size?: number | null
          lead_id?: string | null
          metadata_json?: Json | null
          module?: string
          origin?: string | null
          output_size?: number | null
          saved_data?: boolean | null
          source?: string
          step?: string | null
          timestamp?: string
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orbit_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orbit_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_center"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      orbit_selection_chat: {
        Row: {
          content: string
          created_at: string
          id: string
          lead_id: string
          metadata: Json | null
          property_id: string
          sender_type: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          lead_id: string
          metadata?: Json | null
          property_id: string
          sender_type: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          lead_id?: string
          metadata?: Json | null
          property_id?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "orbit_selection_chat_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orbit_selection_chat_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_center"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "orbit_selection_chat_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          agent_data: Json | null
          area_privativa: number | null
          area_total: number | null
          bedrooms: number | null
          city: string | null
          condo_fee: number | null
          condo_name: string | null
          cover_image: string | null
          created_at: string | null
          description: string | null
          features: string[] | null
          id: string
          ingestion_status: string | null
          ingestion_type: string | null
          internal_code: string | null
          internal_name: string | null
          internal_notes: string | null
          iptu: number | null
          lat: number | null
          lng: number | null
          location_status: string | null
          location_text: string | null
          lote: string | null
          neighborhood: string | null
          parking_spots: number | null
          payment_conditions: Json | null
          photos: string[] | null
          property_embedding: string | null
          quadra: string | null
          score: number | null
          semantic_summary: string | null
          source_domain: string | null
          source_link: string
          status: string
          suites: number | null
          title: string | null
          topics: Json | null
          ui_type: string | null
          value: number | null
          visibility: string | null
          vista_code: string | null
        }
        Insert: {
          agent_data?: Json | null
          area_privativa?: number | null
          area_total?: number | null
          bedrooms?: number | null
          city?: string | null
          condo_fee?: number | null
          condo_name?: string | null
          cover_image?: string | null
          created_at?: string | null
          description?: string | null
          features?: string[] | null
          id?: string
          ingestion_status?: string | null
          ingestion_type?: string | null
          internal_code?: string | null
          internal_name?: string | null
          internal_notes?: string | null
          iptu?: number | null
          lat?: number | null
          lng?: number | null
          location_status?: string | null
          location_text?: string | null
          lote?: string | null
          neighborhood?: string | null
          parking_spots?: number | null
          payment_conditions?: Json | null
          photos?: string[] | null
          property_embedding?: string | null
          quadra?: string | null
          score?: number | null
          semantic_summary?: string | null
          source_domain?: string | null
          source_link: string
          status?: string
          suites?: number | null
          title?: string | null
          topics?: Json | null
          ui_type?: string | null
          value?: number | null
          visibility?: string | null
          vista_code?: string | null
        }
        Update: {
          agent_data?: Json | null
          area_privativa?: number | null
          area_total?: number | null
          bedrooms?: number | null
          city?: string | null
          condo_fee?: number | null
          condo_name?: string | null
          cover_image?: string | null
          created_at?: string | null
          description?: string | null
          features?: string[] | null
          id?: string
          ingestion_status?: string | null
          ingestion_type?: string | null
          internal_code?: string | null
          internal_name?: string | null
          internal_notes?: string | null
          iptu?: number | null
          lat?: number | null
          lng?: number | null
          location_status?: string | null
          location_text?: string | null
          lote?: string | null
          neighborhood?: string | null
          parking_spots?: number | null
          payment_conditions?: Json | null
          photos?: string[] | null
          property_embedding?: string | null
          quadra?: string | null
          score?: number | null
          semantic_summary?: string | null
          source_domain?: string | null
          source_link?: string
          status?: string
          suites?: number | null
          title?: string | null
          topics?: Json | null
          ui_type?: string | null
          value?: number | null
          visibility?: string | null
          vista_code?: string | null
        }
        Relationships: []
      }
      property_history: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          event_date: string | null
          event_type: string
          id: string
          lead_id: string | null
          metadata: Json | null
          new_value: number | null
          old_value: number | null
          property_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_date?: string | null
          event_type: string
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          new_value?: number | null
          old_value?: number | null
          property_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_date?: string | null
          event_type?: string
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          new_value?: number | null
          old_value?: number | null
          property_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_center"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_history_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_interactions: {
        Row: {
          id: string
          interaction_type: string
          lead_id: string | null
          metadata: Json | null
          property_id: string | null
          source: string | null
          timestamp: string | null
        }
        Insert: {
          id?: string
          interaction_type: string
          lead_id?: string | null
          metadata?: Json | null
          property_id?: string | null
          source?: string | null
          timestamp?: string | null
        }
        Update: {
          id?: string
          interaction_type?: string
          lead_id?: string | null
          metadata?: Json | null
          property_id?: string | null
          source?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_center"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "property_interactions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      reengagement_experiments: {
        Row: {
          converted_to_visit: boolean | null
          days_silent: number
          experiment_notes: string | null
          generated_at: string | null
          had_property: boolean | null
          had_response: boolean | null
          id: string
          lead_id: string | null
          message_length: number | null
          next_move_if_reply: string | null
          objective: string | null
          response_confidence: number | null
          response_sentiment: string | null
          response_signal: string | null
          response_time_minutes: number | null
          response_type: string | null
          sent_at: string | null
          sent_at_hour: number | null
          silence_reason: string
          strategy: string
          tone: string
        }
        Insert: {
          converted_to_visit?: boolean | null
          days_silent: number
          experiment_notes?: string | null
          generated_at?: string | null
          had_property?: boolean | null
          had_response?: boolean | null
          id?: string
          lead_id?: string | null
          message_length?: number | null
          next_move_if_reply?: string | null
          objective?: string | null
          response_confidence?: number | null
          response_sentiment?: string | null
          response_signal?: string | null
          response_time_minutes?: number | null
          response_type?: string | null
          sent_at?: string | null
          sent_at_hour?: number | null
          silence_reason: string
          strategy: string
          tone: string
        }
        Update: {
          converted_to_visit?: boolean | null
          days_silent?: number
          experiment_notes?: string | null
          generated_at?: string | null
          had_property?: boolean | null
          had_response?: boolean | null
          id?: string
          lead_id?: string | null
          message_length?: number | null
          next_move_if_reply?: string | null
          objective?: string | null
          response_confidence?: number | null
          response_sentiment?: string | null
          response_signal?: string | null
          response_time_minutes?: number | null
          response_type?: string | null
          sent_at?: string | null
          sent_at_hour?: number | null
          silence_reason?: string
          strategy?: string
          tone?: string
        }
        Relationships: [
          {
            foreignKeyName: "reengagement_experiments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reengagement_experiments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_center"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      reminders: {
        Row: {
          created_at: string | null
          due_at: string
          id: string
          lead_id: string | null
          status: string | null
          type: string | null
        }
        Insert: {
          created_at?: string | null
          due_at: string
          id?: string
          lead_id?: string | null
          status?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string | null
          due_at?: string
          id?: string
          lead_id?: string | null
          status?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_center"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      silence_analyses: {
        Row: {
          analyzed_at: string
          best_contact_window: string | null
          confidence: number | null
          days_silent: number
          emotional_state: string | null
          had_property: boolean | null
          had_response: boolean | null
          id: string
          last_known_intent: string | null
          lead_id: string
          message_sent: boolean | null
          message_text: string | null
          next_move_if_reply: string | null
          next_step_if_ignore: string | null
          next_step_if_reply: string | null
          objective: string | null
          reasoning: string | null
          response_time_minutes: number | null
          sent_at: string | null
          sent_at_hour: number | null
          should_include_properties: boolean
          silence_reason: string
          strategy: string
          urgency: string
        }
        Insert: {
          analyzed_at?: string
          best_contact_window?: string | null
          confidence?: number | null
          days_silent: number
          emotional_state?: string | null
          had_property?: boolean | null
          had_response?: boolean | null
          id?: string
          last_known_intent?: string | null
          lead_id: string
          message_sent?: boolean | null
          message_text?: string | null
          next_move_if_reply?: string | null
          next_step_if_ignore?: string | null
          next_step_if_reply?: string | null
          objective?: string | null
          reasoning?: string | null
          response_time_minutes?: number | null
          sent_at?: string | null
          sent_at_hour?: number | null
          should_include_properties?: boolean
          silence_reason: string
          strategy: string
          urgency: string
        }
        Update: {
          analyzed_at?: string
          best_contact_window?: string | null
          confidence?: number | null
          days_silent?: number
          emotional_state?: string | null
          had_property?: boolean | null
          had_response?: boolean | null
          id?: string
          last_known_intent?: string | null
          lead_id?: string
          message_sent?: boolean | null
          message_text?: string | null
          next_move_if_reply?: string | null
          next_step_if_ignore?: string | null
          next_step_if_reply?: string | null
          objective?: string | null
          reasoning?: string | null
          response_time_minutes?: number | null
          sent_at?: string | null
          sent_at_hour?: number | null
          should_include_properties?: boolean
          silence_reason?: string
          strategy?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "silence_analyses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "silence_analyses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads_center"
            referencedColumns: ["lead_id"]
          },
        ]
      }
    }
    Views: {
      leads_center: {
        Row: {
          acao_sugerida: string | null
          created_at: string | null
          dias_sem_interacao: number | null
          estado_atual: string | null
          last_evaluated_at: string | null
          last_event_type: string | null
          lead_id: string | null
          name: string | null
          origin: string | null
          phone: string | null
          photo_url: string | null
          tem_capsula_ativa: boolean | null
          ultima_interacao_at: string | null
        }
        Insert: {
          acao_sugerida?: string | null
          created_at?: string | null
          dias_sem_interacao?: never
          estado_atual?: never
          last_evaluated_at?: string | null
          last_event_type?: string | null
          lead_id?: string | null
          name?: string | null
          origin?: string | null
          phone?: string | null
          photo_url?: string | null
          tem_capsula_ativa?: never
          ultima_interacao_at?: string | null
        }
        Update: {
          acao_sugerida?: string | null
          created_at?: string | null
          dias_sem_interacao?: never
          estado_atual?: never
          last_evaluated_at?: string | null
          last_event_type?: string | null
          lead_id?: string | null
          name?: string | null
          origin?: string | null
          phone?: string | null
          photo_url?: string | null
          tem_capsula_ativa?: never
          ultima_interacao_at?: string | null
        }
        Relationships: []
      }
      reengagement_learning: {
        Row: {
          avg_response_minutes: number | null
          best_hour: number | null
          had_property: boolean | null
          response_rate_pct: number | null
          sample_count: number | null
          silence_reason: string | null
          strategy: string | null
          tone: string | null
          visit_conversion_pct: number | null
        }
        Relationships: []
      }
      silence_learning: {
        Row: {
          avg_response_min: number | null
          best_hour: number | null
          had_property: boolean | null
          reply_rate_pct: number | null
          silence_reason: string | null
          strategy: string | null
          total_replied: number | null
          total_sent: number | null
          urgency: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_orbit_leads: {
        Args: never
        Returns: {
          acao_sugerida: string
          action_suggested: string
          clarity_level: number
          created_at: string
          current_state: string
          cycle_stage: string
          dias_sem_interacao: number
          estado_atual: string
          followup_active: boolean
          followup_done_today: boolean
          followup_remaining: number
          has_mature_notes: boolean
          interest_score: number
          last_ai_analysis_at: string
          last_event_type: string
          lead_id: string
          momentum_score: number
          name: string
          orbit_stage: string
          orbit_visual_state: string
          origin: string
          phone: string
          photo_url: string
          risk_score: number
          tem_capsula_ativa: boolean
          ultima_interacao_at: string
        }[]
      }
      mark_reengagement_response: {
        Args: { p_lead_id: string; p_response_sentiment?: string }
        Returns: undefined
      }
      match_capsule_embeddings: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          capsule_item_id: string
          similarity: number
        }[]
      }
      match_leads: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          id: string
          name: string
          orbit_stage: string
          photo_url: string
          similarity: number
        }[]
      }
      match_leads_by_vector: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          lead_id: string
          similarity: number
        }[]
      }
      match_memory_embeddings: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          confidence: number
          content: string
          id: string
          lead_id: string
          similarity: number
          type: string
        }[]
      }
      match_properties: {
        Args: {
          exclude_ids?: string[]
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          area_privativa: number
          bedrooms: number
          city: string
          features: string[]
          id: string
          neighborhood: string
          payment_conditions: Json
          similarity: number
          suites: number
          title: string
          value: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    | keyof (DefaultSchema["Tables"] | DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] |
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] |
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] |
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] |
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
    Enums: {},
  },
} as const
