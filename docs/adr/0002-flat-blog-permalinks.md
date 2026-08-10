# Flat blog permalinks

Blog posts are addressed at `/blog/slug/` rather than a date-based `/blog/YYYY/MM/slug/` scheme. Date-based permalinks were considered first (and briefly decided on) but reversed before any posts existed: a flat slug keeps URLs shorter and doesn't tie a post's location to its publish date, so editing or republishing later doesn't imply the URL should move. Post `date` is still recorded in frontmatter and drives ordering/RSS — it's just not encoded in the path.
