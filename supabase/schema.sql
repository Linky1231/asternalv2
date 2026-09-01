-- ========================================
-- ASTERNAL - Supabase Schema
-- ========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- USERS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE,
  name TEXT,
  email TEXT,
  image TEXT,
  bio TEXT DEFAULT '',
  title TEXT DEFAULT '',
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user', 'member')),
  password_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for username lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ========================================
-- POSTS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL,
  likes INTEGER DEFAULT 0,
  favorites INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  media JSONB DEFAULT '[]',
  documents JSONB DEFAULT '[]',
  mentions JSONB DEFAULT '[]',
  hashtags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for sorting by creation time
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);

-- ========================================
-- LIKES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_post ON likes(user_id, post_id);

-- ========================================
-- FAVORITES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_post ON favorites(post_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_post ON favorites(user_id, post_id);

-- ========================================
-- COMMENTS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  likes INTEGER DEFAULT 0,
  parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_comment_id);

-- ========================================
-- COMMENT LIKES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS comment_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, comment_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user_comment ON comment_likes(user_id, comment_id);

-- ========================================
-- FOLLOWS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_follows_pair ON follows(follower_id, following_id);

-- ========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- ========================================
-- USERS POLICIES
-- ========================================
-- Anyone can read users (for profiles, mentions, etc.)
CREATE POLICY "Users are viewable by everyone" ON users
  FOR SELECT USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile (during registration)
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ========================================
-- POSTS POLICIES
-- ========================================
-- Anyone can read posts
CREATE POLICY "Posts are viewable by everyone" ON posts
  FOR SELECT USING (true);

-- Authenticated users can create posts
CREATE POLICY "Authenticated users can create posts" ON posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);

-- Users can update their own posts
CREATE POLICY "Users can update own posts" ON posts
  FOR UPDATE USING (auth.uid() = author_id);

-- Users can delete their own posts
CREATE POLICY "Users can delete own posts" ON posts
  FOR DELETE USING (auth.uid() = author_id);

-- ========================================
-- LIKES POLICIES
-- ========================================
-- Anyone can read likes
CREATE POLICY "Likes are viewable by everyone" ON likes
  FOR SELECT USING (true);

-- Authenticated users can create likes
CREATE POLICY "Authenticated users can create likes" ON likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own likes
CREATE POLICY "Users can delete own likes" ON likes
  FOR DELETE USING (auth.uid() = user_id);

-- ========================================
-- FAVORITES POLICIES
-- ========================================
-- Anyone can read favorites
CREATE POLICY "Favorites are viewable by everyone" ON favorites
  FOR SELECT USING (true);

-- Authenticated users can create favorites
CREATE POLICY "Authenticated users can create favorites" ON favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own favorites
CREATE POLICY "Users can delete own favorites" ON favorites
  FOR DELETE USING (auth.uid() = user_id);

-- ========================================
-- COMMENTS POLICIES
-- ========================================
-- Anyone can read comments
CREATE POLICY "Comments are viewable by everyone" ON comments
  FOR SELECT USING (true);

-- Authenticated users can create comments
CREATE POLICY "Authenticated users can create comments" ON comments
  FOR INSERT WITH CHECK (auth.uid() = author_id);

-- Users can update their own comments
CREATE POLICY "Users can update own comments" ON comments
  FOR UPDATE USING (auth.uid() = author_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments" ON comments
  FOR DELETE USING (auth.uid() = author_id);

-- ========================================
-- COMMENT LIKES POLICIES
-- ========================================
-- Anyone can read comment likes
CREATE POLICY "Comment likes are viewable by everyone" ON comment_likes
  FOR SELECT USING (true);

-- Authenticated users can create comment likes
CREATE POLICY "Authenticated users can create comment likes" ON comment_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own comment likes
CREATE POLICY "Users can delete own comment likes" ON comment_likes
  FOR DELETE USING (auth.uid() = user_id);

-- ========================================
-- FOLLOWS POLICIES
-- ========================================
-- Anyone can read follows
CREATE POLICY "Follows are viewable by everyone" ON follows
  FOR SELECT USING (true);

-- Authenticated users can create follows
CREATE POLICY "Authenticated users can create follows" ON follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

-- Users can delete their own follows
CREATE POLICY "Users can delete own follows" ON follows
  FOR DELETE USING (auth.uid() = follower_id);

-- ========================================
-- STORAGE BUCKETS
-- ========================================
-- Create storage bucket for media
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- ========================================
-- STORAGE POLICIES
-- ========================================
-- Media bucket: anyone can read, authenticated users can upload
CREATE POLICY "Media files are viewable by everyone" ON storage.objects
  FOR SELECT USING (bucket_id = 'media');

CREATE POLICY "Authenticated users can upload media" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'media' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete own media" ON storage.objects
  FOR DELETE USING (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Avatars bucket: anyone can read, authenticated users can upload
CREATE POLICY "Avatar files are viewable by everyone" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can upload avatars" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete own avatars" ON storage.objects
  FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Documents bucket: anyone can read, authenticated users can upload
CREATE POLICY "Document files are viewable by everyone" ON storage.objects
  FOR SELECT USING (bucket_id = 'documents');

CREATE POLICY "Authenticated users can upload documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete own documents" ON storage.objects
  FOR DELETE USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ========================================
-- FUNCTIONS
-- ========================================

-- Function to update user profile
CREATE OR REPLACE FUNCTION update_user_profile(
  p_user_id UUID,
  p_name TEXT DEFAULT NULL,
  p_bio TEXT DEFAULT NULL,
  p_title TEXT DEFAULT NULL,
  p_image TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET
    name = COALESCE(p_name, name),
    bio = COALESCE(p_bio, bio),
    title = COALESCE(p_title, title),
    image = COALESCE(p_image, image),
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to toggle like
CREATE OR REPLACE FUNCTION toggle_post_like(
  p_user_id UUID,
  p_post_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- Check if like exists
  SELECT EXISTS(
    SELECT 1 FROM likes
    WHERE user_id = p_user_id AND post_id = p_post_id
  ) INTO v_exists;

  IF v_exists THEN
    -- Remove like
    DELETE FROM likes WHERE user_id = p_user_id AND post_id = p_post_id;
    UPDATE posts SET likes = likes - 1 WHERE id = p_post_id;
    RETURN FALSE;
  ELSE
    -- Add like
    INSERT INTO likes (user_id, post_id) VALUES (p_user_id, p_post_id);
    UPDATE posts SET likes = likes + 1 WHERE id = p_post_id;
    RETURN TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to toggle favorite
CREATE OR REPLACE FUNCTION toggle_post_favorite(
  p_user_id UUID,
  p_post_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM favorites
    WHERE user_id = p_user_id AND post_id = p_post_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM favorites WHERE user_id = p_user_id AND post_id = p_post_id;
    UPDATE posts SET favorites = favorites - 1 WHERE id = p_post_id;
    RETURN FALSE;
  ELSE
    INSERT INTO favorites (user_id, post_id) VALUES (p_user_id, p_post_id);
    UPDATE posts SET favorites = favorites + 1 WHERE id = p_post_id;
    RETURN TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to toggle follow
CREATE OR REPLACE FUNCTION toggle_follow(
  p_follower_id UUID,
  p_following_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- Prevent self-follow
  IF p_follower_id = p_following_id THEN
    RAISE EXCEPTION 'No puedes seguirte a ti mismo';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM follows
    WHERE follower_id = p_follower_id AND following_id = p_following_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM follows WHERE follower_id = p_follower_id AND following_id = p_following_id;
    RETURN FALSE;
  ELSE
    INSERT INTO follows (follower_id, following_id) VALUES (p_follower_id, p_following_id);
    RETURN TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to toggle comment like
CREATE OR REPLACE FUNCTION toggle_comment_like(
  p_user_id UUID,
  p_comment_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM comment_likes
    WHERE user_id = p_user_id AND comment_id = p_comment_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM comment_likes WHERE user_id = p_user_id AND comment_id = p_comment_id;
    UPDATE comments SET likes = likes - 1 WHERE id = p_comment_id;
    RETURN FALSE;
  ELSE
    INSERT INTO comment_likes (user_id, comment_id) VALUES (p_user_id, p_comment_id);
    UPDATE comments SET likes = likes + 1 WHERE id = p_comment_id;
    RETURN TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- COUNTER FUNCTIONS
-- ========================================

-- Function to increment post likes
CREATE OR REPLACE FUNCTION increment_post_likes(post_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE posts SET likes = likes + 1 WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrement post likes
CREATE OR REPLACE FUNCTION decrement_post_likes(post_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE posts SET likes = GREATEST(0, likes - 1) WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment post favorites
CREATE OR REPLACE FUNCTION increment_post_favorites(post_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE posts SET favorites = favorites + 1 WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrement post favorites
CREATE OR REPLACE FUNCTION decrement_post_favorites(post_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE posts SET favorites = GREATEST(0, favorites - 1) WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment comment likes
CREATE OR REPLACE FUNCTION increment_comment_likes(comment_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE comments SET likes = likes + 1 WHERE id = comment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrement comment likes
CREATE OR REPLACE FUNCTION decrement_comment_likes(comment_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE comments SET likes = GREATEST(0, likes - 1) WHERE id = comment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
