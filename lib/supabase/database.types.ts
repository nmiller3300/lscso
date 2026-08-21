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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      acting_supervisor_grants: {
        Row: {
          created_at: string
          expires_at: string
          granted_by: string
          id: string
          profile_id: string
          revoked_at: string | null
          revoked_by: string | null
          scope: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          granted_by: string
          id?: string
          profile_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          scope: string
          starts_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          granted_by?: string
          id?: string
          profile_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          scope?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "acting_supervisor_grants_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "personnel_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acting_supervisor_grants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "personnel_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acting_supervisor_grants_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "personnel_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_profile_id: string | null
          actor_user_id: string | null
          created_at: string
          id: number
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_profile_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: number
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_profile_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: number
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "personnel_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      call_sign_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          call_sign: string
          created_at: string
          id: string
          profile_id: string
          release_reason: string | null
          released_at: string | null
          released_by: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          call_sign: string
          created_at?: string
          id?: string
          profile_id: string
          release_reason?: string | null
          released_at?: string | null
          released_by?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          call_sign?: string
          created_at?: string
          id?: string
          profile_id?: string
          release_reason?: string | null
          released_at?: string | null
          released_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_sign_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "personnel_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_sign_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "personnel_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_sign_assignments_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "personnel_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      certifications: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          certificate_number: string | null
          created_at: string
          expires_on: string | null
          id: string
          issued_on: string | null
          issuer: string
          name: string
          notes: string | null
          profile_id: string
          requested_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          certificate_number?: string | null
          created_at?: string
          expires_on?: string | null
          id?: string
          issued_on?: string | null
          issuer: string
          name: string
          notes?: string | null
          profile_id: string
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          certificate_number?: string | null
          created_at?: string
          expires_on?: string | null
          id?: string
          issued_on?: string | null
          issuer?: string
          name?: string
          notes?: string | null
          profile_id?: string
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certifications_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "personnel_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "personnel_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certifications_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "personnel_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      command_announcements: {
        Row: {
          active: boolean
          body: string
          created_at: string
          expires_at: string | null
          id: string
          priority: string
          published_at: string
          published_by: string
          requires_acknowledgment: boolean
          title: string
        }
        Insert: {
          active?: boolean
          body: string
          created_at?: string
          expires_at?: string | null
          id?: string
          priority?: string
          published_at?: string
          published_by: string
          requires_acknowledgment?: boolean
          title: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          priority?: string
          published_at?: string
          published_by?: string
          requires_acknowledgment?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "command_announcements_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "personnel_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      disciplinary_point_tiers: {
        Row: {
          action_required: string
          color_key: string
          id: number
          max_points: number
          min_points: number
          sort_order: number
          standing_label: string
          tier_name: string
        }
        Insert: {
          action_required: string
          color_key: string
          id: number
          max_points: number
          min_points: number
          sort_order: number
          standing_label: string
          tier_name: string
        }
        Update: {
          action_required?: string
          color_key?: string
          id?: number
          max_points?: number
          min_points?: number
          sort_order?: number
          standing_label?: string
          tier_name?: string
        }
        Relationships: []
      }
      division_assignments: {
        Row: {
          assigned_by: string | null
          assignment_type: string
          created_at: string
          division: string
          effective_at: string
          ends_at: string | null
          id: string
          notes: string | null
          profile_id: string
        }
        Insert: {
          assigned_by?: string | null
          assignment_type?: string
          created_at?: string
          division: string
          effective_at?: string
          ends_at?: string | null
          id?: string
          notes?: string | null
          profile_id: string
        }
        Update: {
          assigned_by?: string | null
          assignment_type?: string
          created_at?: string
          division?: string
          effective_at?: string
          ends_at?: string | null
          id?: string
          notes?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "division_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "personnel_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "division_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "personnel_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guardian_acknowledgments: {
        Row: {
          acknowledgment_text: string
          call_sign_snapshot: string | null
          created_at: string
          display_name_snapshot: string
          fingerprint_id: string
          guardian_id: string
          id: string
          personnel_id_snapshot: string
          profile_id: string
          rank_snapshot: string
          response_text: string | null
          signature_method: string
          signed_at: string
          typed_name: string | null
        }
        Insert: {
          acknowledgment_text: string
          call_sign_snapshot?: string | null
          created_at?: string
          display_name_snapshot: string
          fingerprint_id: string
          guardian_id: string
          id?: string
          personnel_id_snapshot: string
          profile_id: string
          rank_snapshot: string
          response_text?: string | null
          signature_method: string
          signed_at?: string
          typed_name?: string | null
        }
        Update: {
          acknowledgment_text?: string
          call_sign_snapshot?: string | null
          created_at?: string
          display_name_snapshot?: string
          fingerprint_id?: string
          guardian_id?: string
          id?: string
          personnel_id_snapshot?: string
          profile_id?: string
          rank_snapshot?: string
          response_text?: string | null
          signature_method?: string
          signed_at?: string
          typed_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guardian_acknowledgments_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: true
            referencedRelation: "guardian_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_acknowledgments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "personnel_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guardian_records: {
        Row: {
          acknowledged_at: string | null
          action_taken: string | null
          approved_at: string | null
          approved_by: string | null
          author_profile_id: string
          closed_at: string | null
          command_notes: string | null
          created_at: string
          employee_response: string | null
          escalation_override: boolean
          escalation_reason: string | null
          expected_standard: string | null
          follow_up_due_at: string | null
          follow_up_plan: string | null
          guardian_number: number
          id: string
          incident_at: string
          is_test_record: boolean
          issued_at: string | null
          location: string | null
          observed_behavior: string | null
          points_assessed: number
          policy_reference: string | null
          record_type: string
          status: string
          structured_fields: Json
          subject_profile_id: string
          submitted_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          action_taken?: string | null
          approved_at?: string | null
          approved_by?: string | null
          author_profile_id: string
          closed_at?: string | null
          command_notes?: string | null
          created_at?: string
          employee_response?: string | null
          escalation_override?: boolean
          escalation_reason?: string | null
          expected_standard?: string | null
          follow_up_due_at?: string | null
          follow_up_plan?: string | null
          guardian_number?: number
          id?: string
          incident_at: string
          is_test_record?: boolean
          issued_at?: string | null
          location?: string | null
          observed_behavior?: string | null
          points_assessed?: number
          policy_reference?: string | null
          record_type: string
          status?: string
          structured_fields?: Json
          subject_profile_id: string
          submitted_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          action_taken?: string | null
          approved_at?: string | null
          approved_by?: string | null
          author_profile_id?: string
          closed_at?: string | null
          command_notes?: string | null
          created_at?: string
          employee_response?: string | null
          escalation_override?: boolean
          escalation_reason?: string | null
          expected_standard?: string | null
          follow_up_due_at?: string | null
          follow_up_plan?: string | null
          guardian_number?: number
          id?: string
          incident_at?: string
          is_test_record?: boolean
          issued_at?: string | null
          location?: string | null
          observed_behavior?: string | null
          points_assessed?: number
          policy_reference?: string | null
          record_type?: string
          status?: string
          structured_fields?: Json
          subject_profile_id?: string
          submitted_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardian_records_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "personnel_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_records_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "personnel_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_records_subject_profile_id_fkey"
            columns: ["subject_profile_id"]
            isOneToOne: false
            referencedRelation: "personnel_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          href: string | null
          id: string
          message: string
          notification_type: string
          read_at: string | null
          recipient_profile_id: string
          title: string
        }
        Insert: {
          created_at?: string
          href?: string | null
          id?: string
          message: string
          notification_type: string
          read_at?: string | null
          recipient_profile_id: string
          title: string
        }
        Update: {
          created_at?: string
          href?: string | null
          id?: string
          message?: string
          notification_type?: string
          read_at?: string | null
          recipient_profile_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "personnel_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      personnel_profiles: {
        Row: {
          access_tier: string
          auth_user_id: string | null
          call_sign: string | null
          created_at: string
          credentials_assigned: boolean | null
          deactivated_at: string | null
          deactivated_by: string | null
          display_name: string
          division: string
          greeting_name: string
          id: string
          is_test_account: boolean
          last_sign_in_at: string | null
          personnel_id: string
          rank: string
          status: string
          supervisor_label: string
          updated_at: string
          username: string | null
        }
        Insert: {
          access_tier: string
          auth_user_id?: string | null
          call_sign?: string | null
          created_at?: string
          credentials_assigned?: boolean | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          display_name: string
          division?: string
          greeting_name: string
          id?: string
          is_test_account?: boolean
          last_sign_in_at?: string | null
          personnel_id: string
          rank: string
          status?: string
          supervisor_label?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          access_tier?: string
          auth_user_id?: string | null
          call_sign?: string | null
          created_at?: string
          credentials_assigned?: boolean | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          display_name?: string
          division?: string
          greeting_name?: string
          id?: string
          is_test_account?: boolean
          last_sign_in_at?: string | null
          personnel_id?: string
          rank?: string
          status?: string
          supervisor_label?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personnel_profiles_deactivated_by_fkey"
            columns: ["deactivated_by"]
            isOneToOne: false
            referencedRelation: "personnel_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      personnel_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_notes: string | null
          details: string
          id: string
          is_test_record: boolean
          request_number: number
          request_type: string
          requested_effective_at: string | null
          requester_profile_id: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          details: string
          id?: string
          is_test_record?: boolean
          request_number?: number
          request_type: string
          requested_effective_at?: string | null
          requester_profile_id: string
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          details?: string
          id?: string
          is_test_record?: boolean
          request_number?: number
          request_type?: string
          requested_effective_at?: string | null
          requester_profile_id?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "personnel_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "personnel_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnel_requests_requester_profile_id_fkey"
            columns: ["requester_profile_id"]
            isOneToOne: false
            referencedRelation: "personnel_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          profile_id: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          profile_id: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          profile_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "personnel_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_progress: {
        Row: {
          completed_on: string | null
          created_at: string
          evaluation_notes: string | null
          evaluator_profile_id: string | null
          id: string
          phase: string
          profile_id: string
          program_type: string
          progress_percent: number
          started_on: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_on?: string | null
          created_at?: string
          evaluation_notes?: string | null
          evaluator_profile_id?: string | null
          id?: string
          phase: string
          profile_id: string
          program_type: string
          progress_percent?: number
          started_on?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_on?: string | null
          created_at?: string
          evaluation_notes?: string | null
          evaluator_profile_id?: string | null
          id?: string
          phase?: string
          profile_id?: string
          program_type?: string
          progress_percent?: number
          started_on?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_progress_evaluator_profile_id_fkey"
            columns: ["evaluator_profile_id"]
            isOneToOne: false
            referencedRelation: "personnel_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_progress_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "personnel_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acknowledge_guardian: {
        Args: {
          record_id: string
          response_text?: string
          signature_name: string
        }
        Returns: Json
      }
      admin_assign_call_sign: {
        Args: {
          actor_profile_id: string
          assignment_reason?: string
          new_call_sign: string
          target_profile_id: string
        }
        Returns: Json
      }
      admin_deactivate_profile: {
        Args: { actor_profile_id: string; target_profile_id: string }
        Returns: Json
      }
      issue_guardian: {
        Args: { record_id: string }
        Returns: {
          acknowledged_at: string | null
          action_taken: string | null
          approved_at: string | null
          approved_by: string | null
          author_profile_id: string
          closed_at: string | null
          command_notes: string | null
          created_at: string
          employee_response: string | null
          escalation_override: boolean
          escalation_reason: string | null
          expected_standard: string | null
          follow_up_due_at: string | null
          follow_up_plan: string | null
          guardian_number: number
          id: string
          incident_at: string
          is_test_record: boolean
          issued_at: string | null
          location: string | null
          observed_behavior: string | null
          points_assessed: number
          policy_reference: string | null
          record_type: string
          status: string
          structured_fields: Json
          subject_profile_id: string
          submitted_at: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "guardian_records"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_session_event: {
        Args: { session_event_type: string; session_user_agent?: string }
        Returns: string
      }
      review_guardian: {
        Args: { decision: string; record_id: string; review_notes?: string }
        Returns: {
          acknowledged_at: string | null
          action_taken: string | null
          approved_at: string | null
          approved_by: string | null
          author_profile_id: string
          closed_at: string | null
          command_notes: string | null
          created_at: string
          employee_response: string | null
          escalation_override: boolean
          escalation_reason: string | null
          expected_standard: string | null
          follow_up_due_at: string | null
          follow_up_plan: string | null
          guardian_number: number
          id: string
          incident_at: string
          is_test_record: boolean
          issued_at: string | null
          location: string | null
          observed_behavior: string | null
          points_assessed: number
          policy_reference: string | null
          record_type: string
          status: string
          structured_fields: Json
          subject_profile_id: string
          submitted_at: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "guardian_records"
          isOneToOne: true
          isSetofReturn: false
        }
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
    Enums: {},
  },
} as const
