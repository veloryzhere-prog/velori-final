# VELORI documentation and CMS source

Release: `velori-editorial-2026-10-24-r2`.

The 23 recreated pages are saved in the live CMS. `velori-pages.json` contains the complete page bodies, CSS, JavaScript, content blocks and SEO defaults. Each `.html` file is body content; `document.css` and `document.js` are shared source files. These are actual page sources, not screenshots.

In Admin → Website → Pages, select a page to open Page Studio. HTML, CSS & appearance and JavaScript tabs edit its preserved source. Preview desktop, tablet and mobile before publishing. Save draft does not change the published page. Version history can restore earlier code. Prior published pages and unfinished drafts were retained as `before-editorial-r2-published` and `before-editorial-r2-draft` snapshots.

Use **Load VELORI design** to replace a draft with the bundled current template and the contact details configured in Site settings. Use **Export page source** to download the current editor fields as JSON. Publishing still uses existing CMS permissions, reauthentication and draft conflict checks.

Admin → Website → Footer opens the CMS library. Select **Site directory**. Its Content tab has ordered button blocks: change labels and internal destinations, move blocks, or hide them; publish to update the shared footer. Page code is edited independently in HTML/CSS/JavaScript. Internal links should start with `/`; do not paste a localhost domain into published links. The directory's HTML grid can be edited in its HTML tab.

Future journal articles and vacancies can be authored in the corresponding HTML source. Add sections with unique IDs and links to those IDs. Do not advertise a role, API, subscription or service until it is available. VELORYZ AI is explicitly under construction. Old `/meta-ai`, `/muse` and `/threads` bookmarks redirect to VELORI destinations and are absent from the footer.

Contact currently uses the email published in Site settings. The form prepares a mail draft for review in the visitor's own email app; it does not create a support ticket. After changing the official email, load the current template into the relevant contact/careers/developer pages and review/publish it.

To regenerate bundled sources, run `node scripts/cms/export-documents.mjs`. Optionally set `VELORI_PUBLIC_CONTACT_EMAIL`. The runtime fallback uses the current site setting. Generation does not write to the database.

Full motion enables the paper, orbit, seal and logo scenes; Gentle avoids continuous loops; Off stops decorative animation. Hidden or off-screen scenes pause. The top-left motion control is available before sign-in, and Lite links directly to it.

Chat uses the existing private message attachment flow for GIFs. New installations can run `supabase/operations/enable-message-gif.sql` after the normal messaging migrations. The existing 25 MB maximum and participant access rules remain in force. No external GIF search provider or tracking service is required.
