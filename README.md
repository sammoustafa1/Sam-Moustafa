# Sam Moustafa Real Estate Website

The site is a bilingual, responsive static website. The property portfolio can read published entries from Supabase; without Supabase settings, it displays the supplied portfolio photos locally.

## Set up the database

1. Create a project at [Supabase](https://supabase.com/).
2. In the Supabase dashboard, open **SQL Editor**, paste the contents of `supabase/schema.sql`, and run it.
3. In **Project Settings → API**, copy the project URL and the **anon / publishable** key.
4. Put those two public values in `supabase-config.js`:

   ```js
   window.SITE_CONFIG = {
     supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
     supabaseAnonKey: 'YOUR-ANON-OR-PUBLISHABLE-KEY'
   };
   ```

   The public key is intended for browser use. The database policy allows public reads of published properties and allows visitors to submit contact requests, but does not allow visitors to read submitted leads. **Never put a Supabase `service_role` or secret key in this file.**

## Set up the private admin panel

1. Run `supabase/schema.sql` in the Supabase SQL Editor. It creates the tables and row-level security policies, and creates the `property-images` storage bucket for portfolio photos.
2. In **Authentication → Users**, create your own email/password user. Disable public sign-ups in the Supabase Auth settings so visitors cannot create accounts.
3. In the SQL Editor, replace the example address with the admin account email and run:

   ```sql
   insert into public.admin_users (user_id)
   select id from auth.users where email = 'you@example.com'
   on conflict (user_id) do nothing;
   ```

4. Open `/admin.html` on your deployed site and sign in. The page is not linked from the public site; only an account explicitly listed in `admin_users` can access the dashboard data or change records.

The dashboard lets you read, mark, and delete incoming messages; add, edit, or delete property cards; upload photos; add image descriptions; and publish or hide a listing. Only published properties are returned to the public site. Visitors can submit the contact form, but database policies deny them read access to leads. These protections are enforced by Supabase row-level security, not just by hiding the admin page.

The SQL adds three portfolio entries based on the photos supplied. Their status is displayed as it appeared in those photos, not as a claim of current availability. New dashboard uploads are stored in the public `property-images` bucket so published listings can display them on the website. Do not upload private or sensitive images there. Use a status of `available`, `under_contract`, or `closed`.

## Publish on Netlify

1. Open [Netlify Drop](https://app.netlify.com/drop) and sign in or create a free account.
2. Drag the project folder contents into the drop area. Include `index.html`, `style.css`, `script.js`, `admin.html`, `admin.css`, `admin.js`, `supabase-config.js`, `supabase`, and `imeges`.
3. Netlify will publish the site and provide a shareable URL. You can optionally change the site name from the Netlify dashboard.

The website can be previewed locally by opening `index.html`. Supabase data loads after the project URL and public key are added; the supplied sample photos remain available as a fallback.
