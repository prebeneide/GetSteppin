-- Messages Table
-- Lagrer chat-meldinger mellom venner

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (sender_id != receiver_id)
);

-- Enable Row Level Security
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policies for messages
-- Brukere kan se meldinger hvor de er sender eller receiver
CREATE POLICY "Users can view own messages"
  ON public.messages FOR SELECT
  USING (
    auth.uid() = sender_id OR 
    auth.uid() = receiver_id
  );

-- Brukere kan sende meldinger
CREATE POLICY "Users can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Brukere kan oppdatere egne meldinger (bare sender)
CREATE POLICY "Users can update own sent messages"
  ON public.messages FOR UPDATE
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

-- Brukere kan markere mottatte meldinger som lest
CREATE POLICY "Users can mark received messages as read"
  ON public.messages FOR UPDATE
  USING (auth.uid() = receiver_id)
  WITH CHECK (
    auth.uid() = receiver_id AND
    read_at IS NOT NULL
  );

-- Indexes for rask søking
CREATE INDEX idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX idx_messages_receiver_id ON public.messages(receiver_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX idx_messages_unread ON public.messages(receiver_id, read_at) WHERE read_at IS NULL;

