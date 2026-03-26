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
      canceled_courses: {
        Row: {
          course_name_key: string
          created_at: string
          id: string
          original_course_name: string
          reporting_year: string | null
          user_id: string | null
        }
        Insert: {
          course_name_key: string
          created_at?: string
          id?: string
          original_course_name: string
          reporting_year?: string | null
          user_id?: string | null
        }
        Update: {
          course_name_key?: string
          created_at?: string
          id?: string
          original_course_name?: string
          reporting_year?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          authoring_tool: string | null
          course_length: string | null
          course_style: string | null
          course_type: string | null
          created_at: string
          data_source: string | null
          id: string
          id_assigned: string | null
          interaction_count: number | null
          legal_reviewer: string | null
          name: string
          reporting_year: string | null
          sme: string | null
          status: string
          total_hours: number | null
          updated_at: string
          user_id: string | null
          vertical: string | null
        }
        Insert: {
          authoring_tool?: string | null
          course_length?: string | null
          course_style?: string | null
          course_type?: string | null
          created_at?: string
          data_source?: string | null
          id?: string
          id_assigned?: string | null
          interaction_count?: number | null
          legal_reviewer?: string | null
          name: string
          reporting_year?: string | null
          sme?: string | null
          status?: string
          total_hours?: number | null
          updated_at?: string
          user_id?: string | null
          vertical?: string | null
        }
        Update: {
          authoring_tool?: string | null
          course_length?: string | null
          course_style?: string | null
          course_type?: string | null
          created_at?: string
          data_source?: string | null
          id?: string
          id_assigned?: string | null
          interaction_count?: number | null
          legal_reviewer?: string | null
          name?: string
          reporting_year?: string | null
          sme?: string | null
          status?: string
          total_hours?: number | null
          updated_at?: string
          user_id?: string | null
          vertical?: string | null
        }
        Relationships: []
      }
      sme_collaboration_surveys: {
        Row: {
          additional_comments_id: string | null
          additional_feedback_sme: string | null
          amount_billed: number
          autonomy_course_design_score: number | null
          clarity_goals_score: number | null
          course_key_raw: string | null
          course_name: string
          created_at: string
          effective_hourly_rate: number | null
          feeling_valued_score: number | null
          hours_worked: number
          id: string
          id_assistance_interactions_score: number | null
          id_contribution_development_score: number | null
          id_deadlines_schedule_score: number | null
          id_instructional_design_knowledge_score: number | null
          id_openness_feedback_score: number | null
          id_overall_collaboration_score: number | null
          id_overall_quality_score: number | null
          id_realworld_examples_included: string | null
          id_responsiveness_score: number | null
          id_sme_knowledge_score: number | null
          id_sme_promoter_score: number | null
          incorporation_feedback_score: number | null
          instructional_designer: string | null
          project_id: string | null
          recommend_lexipol_score: number | null
          reporting_year: string | null
          sme: string | null
          sme_email: string | null
          sme_overall_experience_score: number | null
          source_created_at: string | null
          source_row: number | null
          staff_responsiveness_score: number | null
          survey_date: string | null
          tools_resources_score: number | null
          training_support_score: number | null
          upload_id: string | null
          use_expertise_score: number | null
          user_id: string | null
        }
        Insert: {
          additional_comments_id?: string | null
          additional_feedback_sme?: string | null
          amount_billed?: number
          autonomy_course_design_score?: number | null
          clarity_goals_score?: number | null
          course_key_raw?: string | null
          course_name: string
          created_at?: string
          effective_hourly_rate?: number | null
          feeling_valued_score?: number | null
          hours_worked?: number
          id?: string
          id_assistance_interactions_score?: number | null
          id_contribution_development_score?: number | null
          id_deadlines_schedule_score?: number | null
          id_instructional_design_knowledge_score?: number | null
          id_openness_feedback_score?: number | null
          id_overall_collaboration_score?: number | null
          id_overall_quality_score?: number | null
          id_realworld_examples_included?: string | null
          id_responsiveness_score?: number | null
          id_sme_knowledge_score?: number | null
          id_sme_promoter_score?: number | null
          incorporation_feedback_score?: number | null
          instructional_designer?: string | null
          project_id?: string | null
          recommend_lexipol_score?: number | null
          reporting_year?: string | null
          sme?: string | null
          sme_email?: string | null
          sme_overall_experience_score?: number | null
          source_created_at?: string | null
          source_row?: number | null
          staff_responsiveness_score?: number | null
          survey_date?: string | null
          tools_resources_score?: number | null
          training_support_score?: number | null
          upload_id?: string | null
          use_expertise_score?: number | null
          user_id?: string | null
        }
        Update: {
          additional_comments_id?: string | null
          additional_feedback_sme?: string | null
          amount_billed?: number
          autonomy_course_design_score?: number | null
          clarity_goals_score?: number | null
          course_key_raw?: string | null
          course_name?: string
          created_at?: string
          effective_hourly_rate?: number | null
          feeling_valued_score?: number | null
          hours_worked?: number
          id?: string
          id_assistance_interactions_score?: number | null
          id_contribution_development_score?: number | null
          id_deadlines_schedule_score?: number | null
          id_instructional_design_knowledge_score?: number | null
          id_openness_feedback_score?: number | null
          id_overall_collaboration_score?: number | null
          id_overall_quality_score?: number | null
          id_realworld_examples_included?: string | null
          id_responsiveness_score?: number | null
          id_sme_knowledge_score?: number | null
          id_sme_promoter_score?: number | null
          incorporation_feedback_score?: number | null
          instructional_designer?: string | null
          project_id?: string | null
          recommend_lexipol_score?: number | null
          reporting_year?: string | null
          sme?: string | null
          sme_email?: string | null
          sme_overall_experience_score?: number | null
          source_created_at?: string | null
          source_row?: number | null
          staff_responsiveness_score?: number | null
          survey_date?: string | null
          tools_resources_score?: number | null
          training_support_score?: number | null
          upload_id?: string | null
          use_expertise_score?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sme_collaboration_surveys_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sme_collaboration_surveys_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "upload_history"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          category: string | null
          created_at: string
          entry_date: string | null
          hours: number
          id: string
          phase: string
          project_id: string | null
          quarter: string | null
          raw_task_name: string | null
          raw_time_spent: string | null
          upload_id: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          entry_date?: string | null
          hours?: number
          id?: string
          phase: string
          project_id?: string | null
          quarter?: string | null
          raw_task_name?: string | null
          raw_time_spent?: string | null
          upload_id?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          entry_date?: string | null
          hours?: number
          id?: string
          phase?: string
          project_id?: string | null
          quarter?: string | null
          raw_task_name?: string | null
          raw_time_spent?: string | null
          upload_id?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_time_entries_upload"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "upload_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      upload_history: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          id: string
          row_count: number
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          id?: string
          row_count?: number
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
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
