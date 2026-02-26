// This file is the EP5 committed baseline.
// It is intentionally committed so that `pnpm ep5:reset` can restore it via
// `git checkout -- supabase/types.gen.ts`.
//
// Workflow:
//   ep5:reset  → git checkout restores this file (schema without `notes`)
//   ep5:break  → overwrites this file with a stale version (notes absent from types, present in DB)
//   manual fix → supabase gen types typescript --local > supabase/types.gen.ts
//   ep5:verify → confirms types match the live DB (notes present in both)

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
      profiles: {
        Row: {
          created_at: string;
          email: string;
          id: string;
        };
        Insert: {
          created_at?: string | null;
          email: string;
          id?: string;
        };
        Update: {
          created_at?: string | null;
          email?: string;
          id?: string;
        };
        Relationships: [];
      };
      receipts: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          title: string;
          user_id: string | null;
        };
        Insert: {
          amount: number;
          created_at?: string | null;
          id?: string;
          title: string;
          user_id?: string | null;
        };
        Update: {
          amount?: number;
          created_at?: string | null;
          id?: string;
          title?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "receipts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_receipt: {
        Args: {
          title: string;
          amount: number;
        };
        Returns: {
          amount: number;
          created_at: string;
          id: string;
          title: string;
          user_id: string | null;
        };
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
