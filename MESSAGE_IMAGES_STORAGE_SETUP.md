# Message Images Storage Setup

## Problem
Message images are uploaded to `messages/${userId}/...` folder in the `posts` bucket, but the existing INSERT policy only allows uploads to `posts/...` folder.

## Solution
Update the INSERT policy to allow uploads to both `posts/` and `messages/` folders.

## Step-by-Step Instructions

### Update the INSERT Policy

1. Go to Supabase Dashboard
2. Navigate to **Storage** → **posts** bucket
3. Click on the **"Policies"** tab
4. Find the policy named **"Authenticated users can upload post images"**
5. Click on it to edit
6. Update the **WITH CHECK expression** to:
   ```sql
   bucket_id = 'posts' AND
   auth.role() = 'authenticated' AND
   (
     (storage.foldername(name))[1] = 'posts' OR
     (storage.foldername(name))[1] = 'messages'
   )
   ```
7. Click **"Review"** then **"Save policy"**

### Alternative: Create Separate Policy for Messages

If you prefer to keep policies separate, create a new policy:

1. Click **"New Policy"**
2. Select **"For full customization"**
3. Configure:
   - **Policy name**: `Authenticated users can upload message images`
   - **Allowed operation**: `INSERT`
   - **Target roles**: `authenticated`
   - **WITH CHECK expression**:
     ```sql
     bucket_id = 'posts' AND
     auth.role() = 'authenticated' AND
     (storage.foldername(name))[1] = 'messages' AND
     (storage.foldername(name))[2] = auth.uid()::text
     ```
4. Click **"Review"** then **"Save policy"**

## Verification

After updating the policy:
1. Try sending a message with an image in the app
2. Check the **Storage > posts > messages** folder in Dashboard to see if files appear
3. If you get permission errors, double-check that the policy expression is correct

## Notes

- The policy ensures users can only upload to their own `messages/{userId}/` folder
- Message images use the same `posts` bucket as post images for simplicity
- Both approaches work, but updating the existing policy is simpler

