# Storage Setup Guide - Post Images and Message Images

## Overview
To enable image uploads for posts and messages, you need to create a storage bucket in Supabase and set up the necessary policies. Both post images and message images use the same `posts` bucket but in different folders.

## Step-by-Step Instructions

### 1. Create the Storage Bucket

1. Go to your Supabase Dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **"New Bucket"** button
4. Configure the bucket:
   - **Name**: `posts`
   - **Public bucket**: ✅ **Enable** (check this box)
   - Click **"Create bucket"**

### 2. Set Up Storage Policies

After creating the bucket, you need to add policies for access control.

#### Go to Policies Tab:
1. Click on the **"posts"** bucket you just created
2. Click on the **"Policies"** tab
3. You'll see a list of existing policies (probably empty)

#### Policy 1: Public Access (SELECT)

1. Click **"New Policy"**
2. Select **"For full customization"** (ikke bruk template)
3. Configure:
   - **Policy name**: Skriv inn `Public Access Posts`
   - **Allowed operation**: Velg `SELECT` fra dropdown
   - **Target roles**: Velg både `anon` og `authenticated` (holder Shift for å velge flere)
   - **USING expression**: 
     - I dette feltet skal du skrive inn SQL-uttrykket direkte
     - Skriv: `bucket_id = 'posts'`
     - (Erstatt evt. eksisterende tekst i feltet med dette)
4. Click **"Review"** then **"Save policy"**

#### Policy 2: Upload Images (INSERT)

1. Click **"New Policy"**
2. Select **"For full customization"**
3. Configure:
   - **Policy name**: Skriv inn `Authenticated users can upload post images`
   - **Allowed operation**: Velg `INSERT` fra dropdown
   - **Target roles**: Velg `authenticated`
   - **WITH CHECK expression**: 
     - I dette feltet skal du skrive inn hele SQL-uttrykket direkte
     - Kopier og lim inn dette (erstatt alt som allerede står der):
     ```
     bucket_id = 'posts' AND
     auth.role() = 'authenticated' AND
     (
       (storage.foldername(name))[1] = 'posts' OR
       (storage.foldername(name))[1] = 'messages'
     )
     ```
     - **Note**: Dette tillater opplasting til både `posts/` og `messages/` mapper
     - For meldingsbilder: brukere kan bare laste opp til sin egen `messages/{userId}/` mappe
4. Click **"Review"** then **"Save policy"**

#### Policy 3: Update Images (UPDATE)

1. Click **"New Policy"**
2. Select **"For full customization"**
3. Configure:
   - **Policy name**: Skriv inn `Authenticated users can update own post images`
   - **Allowed operation**: Velg `UPDATE` fra dropdown
   - **Target roles**: Velg `authenticated`
   - **USING expression**: 
     - I dette feltet skal du skrive inn hele SQL-uttrykket direkte
     - Kopier og lim inn dette (erstatt alt som allerede står der):
     ```
     bucket_id = 'posts' AND
     auth.role() = 'authenticated' AND
     (storage.foldername(name))[2] = auth.uid()::text
     ```
4. Click **"Review"** then **"Save policy"**

#### Policy 4: Delete Images (DELETE)

1. Click **"New Policy"**
2. Select **"For full customization"**
3. Configure:
   - **Policy name**: Skriv inn `Authenticated users can delete own post images`
   - **Allowed operation**: Velg `DELETE` fra dropdown
   - **Target roles**: Velg `authenticated`
   - **USING expression**: 
     - I dette feltet skal du skrive inn hele SQL-uttrykket direkte
     - Kopier og lim inn dette (erstatt alt som allerede står der):
     ```
     bucket_id = 'posts' AND
     auth.role() = 'authenticated' AND
     (storage.foldername(name))[2] = auth.uid()::text
     ```
4. Click **"Review"** then **"Save policy"**

## Verification

After setting up the bucket and policies:

1. Try uploading an image in the app
2. Check the **Storage > posts** bucket in Dashboard to see if files appear
3. If you get permission errors, double-check that all policies are correctly configured

## Troubleshooting

### "Permission denied" errors:
- Make sure the bucket is marked as **Public**
- Verify all 4 policies are created correctly
- Check that the policy expressions match exactly (especially the folder structure)

### Images not showing:
- Check that the bucket is public
- Verify the SELECT policy allows public access
- Check the image URLs in the database are correct

### Upload fails:
- Verify the INSERT policy is configured
- Check that the folder structure matches: `posts/[user_id]/...`, `posts/[post_id]/...`, or `messages/[user_id]/...`
- Make sure you're logged in (authenticated user)
- If uploading message images, ensure the INSERT policy allows `messages/` folder (see Policy 2 above)

## Notes

- Storage policies cannot be created via SQL migrations due to permission restrictions
- The bucket must be created manually in the Dashboard
- Policies can also be set up via Supabase CLI if you have service_role access, but Dashboard is easier

