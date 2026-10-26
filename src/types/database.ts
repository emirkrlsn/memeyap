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
  public: {
    Tables: {
      memes: {
        Row: {
          boxes: Json
          id: string
          is_submitted: boolean
          player_id: string
          room_id: string
          round: number
          template_id: string
          updated_at: string
        }
        Insert: {
          boxes?: Json
          id?: string
          is_submitted?: boolean
          player_id: string
          room_id: string
          round: number
          template_id: string
          updated_at?: string
        }
        Update: {
          boxes?: Json
          id?: string
          is_submitted?: boolean
          player_id?: string
          room_id?: string
          round?: number
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memes_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memes_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          active_from_round: number
          id: string
          is_connected: boolean
          is_ready: boolean
          joined_at: string
          rerolls_left: number
          room_id: string
          score: number
          user_id: string
          username: string
        }
        Insert: {
          active_from_round?: number
          id?: string
          is_connected?: boolean
          is_ready?: boolean
          joined_at?: string
          rerolls_left?: number
          room_id: string
          score?: number
          user_id: string
          username: string
        }
        Update: {
          active_from_round?: number
          id?: string
          is_connected?: boolean
          is_ready?: boolean
          joined_at?: string
          rerolls_left?: number
          room_id?: string
          score?: number
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          code: string
          created_at: string
          current_round: number
          finished_at: string | null
          host_player_id: string | null
          id: string
          phase_ends_at: string | null
          reroll_limit: number
          round_seconds: number
          status: Database["public"]["Enums"]["room_status"]
          total_rounds: number
          used_template_ids: string[]
          vote_queue: string[]
        }
        Insert: {
          code: string
          created_at?: string
          current_round?: number
          finished_at?: string | null
          host_player_id?: string | null
          id?: string
          phase_ends_at?: string | null
          reroll_limit?: number
          round_seconds?: number
          status?: Database["public"]["Enums"]["room_status"]
          total_rounds?: number
          used_template_ids?: string[]
          vote_queue?: string[]
        }
        Update: {
          code?: string
          created_at?: string
          current_round?: number
          finished_at?: string | null
          host_player_id?: string | null
          id?: string
          phase_ends_at?: string | null
          reroll_limit?: number
          round_seconds?: number
          status?: Database["public"]["Enums"]["room_status"]
          total_rounds?: number
          used_template_ids?: string[]
          vote_queue?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "rooms_host_player_id_fkey"
            columns: ["host_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          created_at: string
          default_boxes: Json
          height: number
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["template_kind"]
          source_name: string
          storage_path: string
          width: number
        }
        Insert: {
          created_at?: string
          default_boxes?: Json
          height: number
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["template_kind"]
          source_name: string
          storage_path: string
          width: number
        }
        Update: {
          created_at?: string
          default_boxes?: Json
          height?: number
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["template_kind"]
          source_name?: string
          storage_path?: string
          width?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      advance_phase: { Args: never; Returns: undefined }
      create_room: { Args: { p_username: string }; Returns: string }
      heartbeat: { Args: never; Returns: undefined }
      join_room: {
        Args: { p_code: string; p_username: string }
        Returns: string
      }
      leave_room: { Args: never; Returns: undefined }
      reroll_template: { Args: never; Returns: string }
      save_meme: { Args: { p_boxes: Json }; Returns: undefined }
      server_now: { Args: never; Returns: string }
      set_ready: { Args: { p_ready: boolean }; Returns: undefined }
      start_game: { Args: never; Returns: undefined }
      update_settings: {
        Args: {
          p_reroll_limit: number
          p_round_seconds: number
          p_total_rounds: number
        }
        Returns: undefined
      }
    }
    Enums: {
      room_status:
        | "lobby"
        | "creating"
        | "voting"
        | "reveal"
        | "round_results"
        | "final"
      template_kind: "image" | "gif"
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
  public: {
    Enums: {
      room_status: [
        "lobby",
        "creating",
        "voting",
        "reveal",
        "round_results",
        "final",
      ],
      template_kind: ["image", "gif"],
    },
  },
} as const
