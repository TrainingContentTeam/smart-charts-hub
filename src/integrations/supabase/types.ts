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
      course_alias_config: {
        Row: {
          alias_scope: string
          alias_title_compact: string
          alias_title_normalized: string
          alias_title_raw: string
          canonical_title_compact: string
          canonical_title_normalized: string
          canonical_title_raw: string
          created_at: string
          id: string
          notes: string | null
          reporting_year: string | null
          target_project_key: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          alias_scope?: string
          alias_title_compact: string
          alias_title_normalized: string
          alias_title_raw: string
          canonical_title_compact: string
          canonical_title_normalized: string
          canonical_title_raw: string
          created_at?: string
          id?: string
          notes?: string | null
          reporting_year?: string | null
          target_project_key?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          alias_scope?: string
          alias_title_compact?: string
          alias_title_normalized?: string
          alias_title_raw?: string
          canonical_title_compact?: string
          canonical_title_normalized?: string
          canonical_title_raw?: string
          created_at?: string
          id?: string
          notes?: string | null
          reporting_year?: string | null
          target_project_key?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      person_alias_config: {
        Row: {
          alias_name_normalized: string
          alias_name_raw: string
          canonical_name: string
          created_at: string
          id: string
          notes: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          alias_name_normalized: string
          alias_name_raw: string
          canonical_name: string
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          alias_name_normalized?: string
          alias_name_raw?: string
          canonical_name?: string
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      person_role_config: {
        Row: {
          canonical_name: string
          created_at: string
          id: string
          notes: string | null
          role_group: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          canonical_name: string
          created_at?: string
          id?: string
          notes?: string | null
          role_group: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          canonical_name?: string
          created_at?: string
          id?: string
          notes?: string | null
          role_group?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      raw_project_import_rows: {
        Row: {
          authoring_tool: string
          compact_course_name: string
          course_length_raw: string
          course_style: string
          course_type: string
          created_at: string
          id: string
          id_assigned_raw: string
          interaction_count: number | null
          legal_reviewer_raw: string
          normalized_course_name: string
          parse_warnings: Json
          project_total_minutes: number
          raw_course_name: string
          raw_row: Json
          raw_status: string
          raw_time_spent: string
          reporting_label: string
          reporting_year: string | null
          row_number: number
          sme_assigned_raw: string
          source_dataset: string
          source_file_name: string | null
          upload_id: string | null
          user_id: string | null
          vertical_raw: string
        }
        Insert: {
          authoring_tool?: string
          compact_course_name?: string
          course_length_raw?: string
          course_style?: string
          course_type?: string
          created_at?: string
          id?: string
          id_assigned_raw?: string
          interaction_count?: number | null
          legal_reviewer_raw?: string
          normalized_course_name?: string
          parse_warnings?: Json
          project_total_minutes?: number
          raw_course_name?: string
          raw_row?: Json
          raw_status?: string
          raw_time_spent?: string
          reporting_label?: string
          reporting_year?: string | null
          row_number: number
          sme_assigned_raw?: string
          source_dataset: string
          source_file_name?: string | null
          upload_id?: string | null
          user_id?: string | null
          vertical_raw?: string
        }
        Update: {
          authoring_tool?: string
          compact_course_name?: string
          course_length_raw?: string
          course_style?: string
          course_type?: string
          created_at?: string
          id?: string
          id_assigned_raw?: string
          interaction_count?: number | null
          legal_reviewer_raw?: string
          normalized_course_name?: string
          parse_warnings?: Json
          project_total_minutes?: number
          raw_course_name?: string
          raw_row?: Json
          raw_status?: string
          raw_time_spent?: string
          reporting_label?: string
          reporting_year?: string | null
          row_number?: number
          sme_assigned_raw?: string
          source_dataset?: string
          source_file_name?: string | null
          upload_id?: string | null
          user_id?: string | null
          vertical_raw?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_project_import_rows_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "upload_history"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_sme_feedback_rows: {
        Row: {
          amount_billed: number | null
          course_key_compact: string
          course_key_normalized: string
          course_key_raw: string
          course_name_compact: string
          course_name_normalized: string
          course_name_raw: string
          created_at: string
          hours_worked: number | null
          id: string
          instructional_designer_raw: string
          internal_raw: string
          parse_warnings: Json
          raw_row: Json
          reporting_year: string | null
          row_number: number
          sme_email_raw: string
          sme_raw: string
          source_file_name: string | null
          survey_date: string | null
          upload_id: string | null
          user_id: string | null
        }
        Insert: {
          amount_billed?: number | null
          course_key_compact?: string
          course_key_normalized?: string
          course_key_raw?: string
          course_name_compact?: string
          course_name_normalized?: string
          course_name_raw?: string
          created_at?: string
          hours_worked?: number | null
          id?: string
          instructional_designer_raw?: string
          internal_raw?: string
          parse_warnings?: Json
          raw_row?: Json
          reporting_year?: string | null
          row_number: number
          sme_email_raw?: string
          sme_raw?: string
          source_file_name?: string | null
          survey_date?: string | null
          upload_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount_billed?: number | null
          course_key_compact?: string
          course_key_normalized?: string
          course_key_raw?: string
          course_name_compact?: string
          course_name_normalized?: string
          course_name_raw?: string
          created_at?: string
          hours_worked?: number | null
          id?: string
          instructional_designer_raw?: string
          internal_raw?: string
          parse_warnings?: Json
          raw_row?: Json
          reporting_year?: string | null
          row_number?: number
          sme_email_raw?: string
          sme_raw?: string
          source_file_name?: string | null
          survey_date?: string | null
          upload_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "raw_sme_feedback_rows_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "upload_history"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_time_log_rows: {
        Row: {
          compact_course_name: string
          created_at: string
          id: string
          log_date: string | null
          minutes: number
          normalized_course_name: string
          parse_warnings: Json
          raw_category: string
          raw_course_name: string
          raw_date: string
          raw_row: Json
          raw_time_spent: string
          raw_user: string
          row_number: number
          source_file_name: string | null
          upload_id: string | null
          user_id: string | null
        }
        Insert: {
          compact_course_name?: string
          created_at?: string
          id?: string
          log_date?: string | null
          minutes?: number
          normalized_course_name?: string
          parse_warnings?: Json
          raw_category?: string
          raw_course_name?: string
          raw_date?: string
          raw_row?: Json
          raw_time_spent?: string
          raw_user?: string
          row_number: number
          source_file_name?: string | null
          upload_id?: string | null
          user_id?: string | null
        }
        Update: {
          compact_course_name?: string
          created_at?: string
          id?: string
          log_date?: string | null
          minutes?: number
          normalized_course_name?: string
          parse_warnings?: Json
          raw_category?: string
          raw_course_name?: string
          raw_date?: string
          raw_row?: Json
          raw_time_spent?: string
          raw_user?: string
          row_number?: number
          source_file_name?: string | null
          upload_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "raw_time_log_rows_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "upload_history"
            referencedColumns: ["id"]
          },
        ]
      }
      sme_manual_join_overrides: {
        Row: {
          course_key_compact: string
          course_name_compact: string
          created_at: string
          id: string
          notes: string | null
          reporting_year: string | null
          target_project_key: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          course_key_compact: string
          course_name_compact: string
          created_at?: string
          id?: string
          notes?: string | null
          reporting_year?: string | null
          target_project_key: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          course_key_compact?: string
          course_name_compact?: string
          created_at?: string
          id?: string
          notes?: string | null
          reporting_year?: string | null
          target_project_key?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      upload_history: {
        Row: {
          created_at: string
          dataset_type: string | null
          file_name: string
          file_size: number | null
          id: string
          row_count: number
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          dataset_type?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          row_count?: number
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          dataset_type?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          row_count?: number
          status?: string
          user_id?: string | null
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
      work_entity_decisions: {
        Row: {
          created_at: string
          decision_type: string
          id: string
          notes: string | null
          reporting_year: string | null
          source_title_compact: string
          source_title_normalized: string
          source_title_raw: string
          standalone_title: string | null
          target_project_key: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          decision_type: string
          id?: string
          notes?: string | null
          reporting_year?: string | null
          source_title_compact: string
          source_title_normalized: string
          source_title_raw: string
          standalone_title?: string | null
          target_project_key?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          decision_type?: string
          id?: string
          notes?: string | null
          reporting_year?: string | null
          source_title_compact?: string
          source_title_normalized?: string
          source_title_raw?: string
          standalone_title?: string | null
          target_project_key?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_all_users_with_roles: {
        Args: never
        Returns: {
          created_at: string
          email: string
          role: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
