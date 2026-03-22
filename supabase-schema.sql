-- ============================================================
-- EventSphereX Digital Business Cards - Supabase Schema
-- Run this in the Supabase SQL Editor (all at once)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PROFILES TABLE (user profiles linked to Supabase Auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'individual', 'team', 'enterprise')),
  plan_expires_at TIMESTAMPTZ,
  razorpay_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for looking up profiles by email
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles (email);

-- ============================================================
-- 2. CARDS TABLE (digital business cards)
-- ============================================================
CREATE TABLE IF NOT EXISTS cards (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles (id) ON DELETE CASCADE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  job_title TEXT,
  company TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  whatsapp TEXT,
  linkedin TEXT,
  instagram TEXT,
  twitter TEXT,
  bio TEXT,
  photo_url TEXT,
  logo_url TEXT,
  color_theme TEXT DEFAULT 'green',
  card_style TEXT DEFAULT 'classic',
  is_active BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  save_count INTEGER DEFAULT 0,
  qr_scan_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast public card lookups by slug
CREATE INDEX IF NOT EXISTS idx_cards_slug ON cards (slug);

-- Index for fetching all cards belonging to a user
CREATE INDEX IF NOT EXISTS idx_cards_user_id ON cards (user_id);

-- Index for public listings of active cards
CREATE INDEX IF NOT EXISTS idx_cards_active ON cards (is_active) WHERE is_active = true;

-- ============================================================
-- 3. CARD_ANALYTICS TABLE (track views, saves, scans, shares)
-- ============================================================
CREATE TABLE IF NOT EXISTS card_analytics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  card_id UUID REFERENCES cards (id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'save', 'qr_scan', 'share')),
  viewer_ip TEXT,
  viewer_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying analytics by card
CREATE INDEX IF NOT EXISTS idx_card_analytics_card_id ON card_analytics (card_id);

-- Index for filtering by event type
CREATE INDEX IF NOT EXISTS idx_card_analytics_event_type ON card_analytics (event_type);

-- Index for time-range queries on analytics
CREATE INDEX IF NOT EXISTS idx_card_analytics_created_at ON card_analytics (created_at);

-- ============================================================
-- 4. PAYMENTS TABLE (Razorpay payment records)
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles (id) ON DELETE CASCADE NOT NULL,
  razorpay_payment_id TEXT,
  razorpay_order_id TEXT,
  razorpay_subscription_id TEXT,
  plan TEXT,
  amount INTEGER,
  currency TEXT DEFAULT 'INR',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'captured', 'failed', 'refunded')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fetching payments by user
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments (user_id);

-- Index for looking up by Razorpay payment ID
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_id ON payments (razorpay_payment_id);


-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- PROFILES policies
-- ------------------------------------------------------------

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow insert from the trigger (service role) and the user themselves
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ------------------------------------------------------------
-- CARDS policies
-- ------------------------------------------------------------

-- Anyone can read active cards (public card pages)
CREATE POLICY "Anyone can view active cards"
  ON cards FOR SELECT
  USING (is_active = true);

-- Authenticated users can also read their own inactive cards
CREATE POLICY "Users can view own cards"
  ON cards FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own cards
CREATE POLICY "Users can create own cards"
  ON cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own cards
CREATE POLICY "Users can update own cards"
  ON cards FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own cards
CREATE POLICY "Users can delete own cards"
  ON cards FOR DELETE
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- CARD_ANALYTICS policies
-- ------------------------------------------------------------

-- Anyone can insert analytics (anonymous visitors trigger views)
CREATE POLICY "Anyone can insert analytics"
  ON card_analytics FOR INSERT
  WITH CHECK (true);

-- Users can read analytics for their own cards
CREATE POLICY "Users can read own card analytics"
  ON card_analytics FOR SELECT
  USING (
    card_id IN (
      SELECT id FROM cards WHERE user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- PAYMENTS policies
-- ------------------------------------------------------------

-- Users can read their own payments
CREATE POLICY "Users can read own payments"
  ON payments FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert/update payments (no user-facing policy)
-- Payments are created server-side via Razorpay webhook with the service key


-- ============================================================
-- FUNCTIONS
-- ============================================================

-- ------------------------------------------------------------
-- increment_view_count: bumps the counter and logs an analytics event
-- Called from the client when a public card page is loaded
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION increment_view_count(
  p_card_id UUID,
  p_viewer_ip TEXT DEFAULT NULL,
  p_viewer_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Increment the view counter on the card
  UPDATE cards
  SET view_count = view_count + 1,
      updated_at = now()
  WHERE id = p_card_id;

  -- Insert an analytics record
  INSERT INTO card_analytics (card_id, event_type, viewer_ip, viewer_agent)
  VALUES (p_card_id, 'view', p_viewer_ip, p_viewer_agent);
END;
$$;

-- ------------------------------------------------------------
-- increment_save_count: bumps save counter and logs analytics
-- Called when a visitor saves the contact / downloads vCard
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION increment_save_count(
  p_card_id UUID,
  p_viewer_ip TEXT DEFAULT NULL,
  p_viewer_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE cards
  SET save_count = save_count + 1,
      updated_at = now()
  WHERE id = p_card_id;

  INSERT INTO card_analytics (card_id, event_type, viewer_ip, viewer_agent)
  VALUES (p_card_id, 'save', p_viewer_ip, p_viewer_agent);
END;
$$;

-- ------------------------------------------------------------
-- increment_qr_scan_count: bumps QR scan counter and logs analytics
-- Called when a card is accessed via QR code
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION increment_qr_scan_count(
  p_card_id UUID,
  p_viewer_ip TEXT DEFAULT NULL,
  p_viewer_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE cards
  SET qr_scan_count = qr_scan_count + 1,
      updated_at = now()
  WHERE id = p_card_id;

  INSERT INTO card_analytics (card_id, event_type, viewer_ip, viewer_agent)
  VALUES (p_card_id, 'qr_scan', p_viewer_ip, p_viewer_agent);
END;
$$;

-- ------------------------------------------------------------
-- handle_new_user: auto-creates a profile row when a user signs up
-- Triggered by Supabase Auth on every new registration
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  );
  RETURN NEW;
END;
$$;

-- Trigger that fires after a new user is inserted into auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ------------------------------------------------------------
-- auto_update_timestamp: keeps updated_at current on any row change
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION auto_update_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply auto-update trigger to profiles
CREATE OR REPLACE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_timestamp();

-- Apply auto-update trigger to cards
CREATE OR REPLACE TRIGGER cards_updated_at
  BEFORE UPDATE ON cards
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_timestamp();


-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

-- Create the avatars bucket (profile photos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Create the logos bucket (company logos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- STORAGE POLICIES: avatars
-- ------------------------------------------------------------

-- Anyone can view avatar images (public bucket)
CREATE POLICY "Public read access for avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Authenticated users can upload to their own folder (avatars/USER_ID/*)
CREATE POLICY "Users can upload own avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can update their own avatar files
CREATE POLICY "Users can update own avatars"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can delete their own avatar files
CREATE POLICY "Users can delete own avatars"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ------------------------------------------------------------
-- STORAGE POLICIES: logos
-- ------------------------------------------------------------

-- Anyone can view logo images (public bucket)
CREATE POLICY "Public read access for logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'logos');

-- Authenticated users can upload to their own folder (logos/USER_ID/*)
CREATE POLICY "Users can upload own logos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'logos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can update their own logo files
CREATE POLICY "Users can update own logos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'logos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can delete their own logo files
CREATE POLICY "Users can delete own logos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'logos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ============================================================
-- DONE
-- Paste this entire file into the Supabase SQL Editor and run it.
-- ============================================================
