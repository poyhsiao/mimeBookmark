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
          id: string;
          email: string;
          display_name: string | null;
          avatar_url: string | null;
          timezone: string;
          subscription_tier: 'free' | 'pro' | 'team';
          subscription_status: string;
          subscription_id: string | null;
          stripe_customer_id: string | null;
          bookmarks_limit: number;
          collections_limit: number;
          tags_limit: number;
          bookmarks_count: number;
          storage_used_bytes: number;
          preferences: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      collections: {
        Row: {
          id: string;
          user_id: string;
          parent_id: string | null;
          name: string;
          description: string | null;
          color: string;
          icon: string;
          is_public: boolean;
          is_favorite: boolean;
          sort_order: number;
          bookmarks_count: number;
          metadata: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['collections']['Row'], 'created_at' | 'updated_at' | 'deleted_at'>;
        Update: Partial<Database['public']['Tables']['collections']['Insert']>;
      };
      bookmarks: {
        Row: {
          id: string;
          user_id: string;
          url: string;
          title: string | null;
          description: string | null;
          domain: string;
          favicon_url: string | null;
          og_image: string | null;
          og_title: string | null;
          og_description: string | null;
          metadata: Json;
          clicks: number;
          last_opened_at: string | null;
          is_archived: boolean;
          is_favorite: boolean;
          is_read_later: boolean;
          source: 'web' | 'extension' | 'import' | 'api';
          cached_content: string | null;
          cached_at: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          user_notes: string | null;
          user_rating: number | null;
        };
        Insert: Omit<Database['public']['Tables']['bookmarks']['Row'], 'created_at' | 'updated_at' | 'deleted_at' | 'id' | 'domain'>;
        Update: Partial<Database['public']['Tables']['bookmarks']['Insert']>;
      };
      tags: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          usage_count: number;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['tags']['Row'], 'created_at' | 'updated_at' | 'deleted_at'>;
        Update: Partial<Database['public']['Tables']['tags']['Insert']>;
      };
      annotations: {
        Row: {
          id: string;
          user_id: string;
          bookmark_id: string;
          content: string;
          content_type: 'note' | 'summary' | 'highlights' | 'custom';
          highlight_start: number | null;
          highlight_end: number | null;
          highlight_text: string | null;
          visibility: 'private' | 'shared' | 'public';
          is_premium: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['annotations']['Row'], 'created_at' | 'updated_at' | 'deleted_at'>;
        Update: Partial<Database['public']['Tables']['annotations']['Insert']>;
      };
      bookmark_tags: {
        Row: {
          bookmark_id: string;
          tag_id: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['bookmark_tags']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['bookmark_tags']['Insert']>;
      };
      collection_bookmarks: {
        Row: {
          collection_id: string;
          bookmark_id: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['collection_bookmarks']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['collection_bookmarks']['Insert']>;
      };
      recommendation_rules: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          priority: number;
          is_active: boolean;
          min_tier: 'free' | 'pro' | 'team';
          conditions: Json;
          recommendations: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['recommendation_rules']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['recommendation_rules']['Insert']>;
      };
      user_recommendations: {
        Row: {
          id: string;
          user_id: string;
          rule_id: string;
          bookmark_url: string | null;
          title: string | null;
          description: string | null;
          cta_text: string | null;
          is_dismissed: boolean;
          dismissed_at: string | null;
          clicked_at: string | null;
          impression_count: number;
          last_shown_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_recommendations']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['user_recommendations']['Insert']>;
      };
      recommendation_analytics: {
        Row: {
          id: string;
          rule_id: string;
          user_id: string | null;
          event_type: 'impression' | 'click' | 'dismiss' | 'conversion';
          revenue_cents: number;
          metadata: Json;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['recommendation_analytics']['Row'], 'created_at' | 'user_id'> & { user_id: string };
        Update: Partial<Database['public']['Tables']['recommendation_analytics']['Insert']>;
      };
    };
  };
}
