# Rosoen student resources: setup and owner guide

This GitHub Pages site lets students pick a lesson, choose a version, and download it. Day-to-day changes happen in one file: `resources.json`.

## What is in this folder

| Path | What it is | Edit it? |
|---|---|---|
| `index.html` | Page layout and wording | Rarely |
| `styles.css` | Colours, fonts, and layout | Rarely |
| `app.js` | Reads `resources.json`, builds the choices, and handles text size | No |
| `resources.json` | Exam reminder, lessons, file paths, availability, dates | Yes, often |
| `downloads/` | Student-facing PowerPoint and PDF files | Add or replace files |
| `recordings/` | Lesson videos (placeholder, none supplied yet) | Add videos later |
| `favicon.svg` | Browser tab icon | No |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are | No |
| `README.md` | This guide | No |

## Setup in a new repository

1. On GitHub, create a **public** repository. GitHub Pages on a free account needs a public repository. Do not add a README, licence, or `.gitignore` when you create it, so the repository starts empty.
2. Open the empty repository, select **Add file**, then **Upload files**. Drag in the contents of this folder: `index.html`, `styles.css`, `app.js`, `resources.json`, `favicon.svg`, `.nojekyll`, `README.md`, and the `downloads` and `recordings` folders. Select **Commit changes**.
   Some computers hide files that start with a dot. If `.nojekyll` does not upload, select **Add file**, then **Create new file**, type `.nojekyll` as the name, leave the box empty, and commit.
3. Select **Settings**, then **Pages**. Under **Build and deployment**, set **Source** to **Deploy from a branch**, set the branch to **main** and the folder to **/ (root)**, then select **Save**.
4. Do not add a custom domain. Leave the **Custom domain** box in **Settings**, then **Pages** empty.
5. Wait one to two minutes, then open the site at `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY-NAME/`. Replace the two parts in capitals with your account name and repository name.

Upload from a computer. Drag and drop does not work from a phone.

## Check the downloads folder

The `downloads` folder must contain these exact file names. The page looks for them by name, so a different name shows "Not on the site yet" instead of a download button.

- `GED_RLA_Section_1.pptx`
- `Rosoen_GED_Grammar_Language_Recording.pptx`
- `Rosoen_GED_RLA_Tuesday_Presenatation.pptx`

These copies have speaker notes removed. Keep the original decks with speaker notes off GitHub.

## Change the exam reminder

Open `resources.json`, select the pencil icon, and edit `examReminder.text`. Use plain text only. To hide the banner, change `examReminder.show` to `false`.

## Add or replace a presentation

1. Select **Add file**, then **Upload files**, and upload the PowerPoint into `downloads/`. Use a simple name with no spaces, such as `rla-section-2.pptx`. To replace a version, upload a file with the same name and confirm the replacement.
2. Edit `resources.json`. Copy an existing lesson block and change `id` and `title`. Set `presentation.path` to `downloads/rla-section-2.pptx`, `presentation.available` to `true`, and the dates.
3. Commit the change.

## Add the recording later

Recordings are placeholders until you upload them. Students see "Coming soon" until then.

**Option A: upload a video to `recordings/`.** GitHub's web uploader accepts files up to 25 MB at a time, and GitHub will not store files over 100 MB. Full lesson videos are often bigger than that.

**Option B: use a video link.** Upload the video to an unlisted YouTube video or another hosting service, then paste the full `https://` link into `recording.path`. Students open it in a new tab.

Then, in `resources.json` for that lesson:

- Set `recording.status` to `"available"`.
- Set `recording.path` to the file path or link.
- Set `recording.lastUpdated` to the date.

Students see **Download recording** (or **Open recording** for a link) once the page confirms the file. Students who already have the page open should select **Refresh availability**.

## Speaker notes

Speaker notes stay out of this repository by default. To share a notes version, upload it to `downloads/` under a new name, then set `speakerNotes.path` to that file, `speakerNotes.available` to `true`, and `speakerNotes.status` to `"student_accessible"`. Only that status shows the "with speaker notes" choices. Setting it back to `"instructor_only"` hides them, but it does not delete the file. To remove a file completely, delete it from the repository.

## Important: everything in this repository is public

Anyone with a file's link can open it, even if the page does not list it. Do not upload instructor scripts, private notes, or anything students should not see. Deleting a file from the repository removes it from the site after the next deploy.

## Hide choices for a lesson

- To hide the recording choices, set `recording.status` to `"none"`.
- To hide the speaker-note choices, set `speakerNotes.status` to `"none"` or `"instructor_only"`.

## Add a PDF handout

Upload the PDF to `downloads/`, then add an entry to that lesson's `handouts` list. Handouts appear for every version, labelled as PDFs:

```json
"handouts": [
  {
    "title": "Printable practice sheet",
    "description": "Two pages of practice questions.",
    "fileType": "PDF",
    "path": "downloads/grammar-practice-sheet.pdf",
    "available": true,
    "lastUpdated": "2026-11-17"
  }
]
```

## Check the JSON before you commit

`resources.json` must be valid JSON. One missing comma, or a curly quotation mark where the code needs a straight one, stops the whole list from loading. Paste the file into a JSON validator such as jsonlint.com before committing. If the page says it could not load the lesson list, the JSON is the most likely cause.

## Text size for students

Students choose Small, Medium, Large, or Extra large at the top of the page. Small is the default. The choice is saved on the student's device. You do not need to change anything to support this.

When you upload a changed `styles.css` or `app.js`, increase the number after `?v=` in `index.html` (for example from `styles.css?v=4` to `styles.css?v=5`). This makes phones load the new file instead of a saved copy.

## Field reference

| Field | Where | Meaning |
|---|---|---|
| `examReminder.show` | top level | `true` shows the exam banner. `false` hides it. |
| `examReminder.text` | top level | The exam reminder text (plain text). |
| `studyReminder` | top level | The line shown under the downloads. |
| `comingSoonMessage` | top level | Message shown while a recording is coming soon. |
| `lastUpdated` | top level | Shown in the footer as "Materials last updated". Format: YYYY-MM-DD. |
| `id` | lesson | Unique, lower case, no spaces, for example `rla-section-2`. |
| `title` | lesson | The lesson title students see. |
| `description` | lesson | One or two sentences shown on the lesson card. |
| `lastUpdated` | lesson | Date the lesson was last changed. Format: YYYY-MM-DD. |
| `presentation.fileType` | lesson | Label shown on the card, for example `"PowerPoint (.pptx)"`. |
| `presentation.path` | lesson | Path to the file, relative to the site, for example `downloads/file.pptx`. |
| `presentation.available` | lesson | `true` only when the file has been uploaded. |
| `presentation.lastUpdated` | lesson | Date the file was last replaced. |
| `speakerNotes.status` | lesson | `none` (no notes), `instructor_only` (hidden), or `student_accessible` (shown). |
| `speakerNotes.path`, `available`, `fileType`, `lastUpdated` | lesson | Same meaning as the presentation fields, for the notes version. |
| `recording.status` | lesson | `none` (hides recording choices), `coming_soon` (shows the coming soon message), or `available` (shows the download once confirmed). |
| `recording.path` | lesson | Path inside `recordings/`, or a full `https://` link. |
| `recording.fileType` | lesson | Label shown on the card, for example `"MP4 video"`. |
| `recording.lastUpdated` | lesson | Date the recording was added. |
| `handouts` | lesson | Optional list of PDF handouts (see above). |
| `note` | any | Your own notes. The page ignores it. |

## How the page protects against broken links

A download button appears only when a file is marked available and the page has confirmed that the file exists. Files that are listed but missing show "Not on the site yet" instead of a broken link. Recordings marked `coming_soon` never produce a link.

## Troubleshooting

- **The page still shows old content.** Wait a couple of minutes after committing, then reload. Hard refresh with Ctrl+Shift+R (Cmd+Shift+R on a Mac).
- **A download says "Not on the site yet".** The `path` must match the file name exactly, including capital letters, spaces, and spelling. `Rla.pptx` and `rla.pptx` are different files.
- **The page says it could not load the lesson list.** Check `resources.json` for JSON errors, as described above.
- **The page does not load when you double-click `index.html`.** Browsers block `resources.json` when a page is opened as a local file. Use the GitHub Pages address, or preview locally with `python3 -m http.server 8000` and open `http://localhost:8000`.

## Why there is no upload page

Management happens through GitHub's own signed-in interface, so no passwords or tokens are stored in the site. A browser-only uploader cannot save files permanently to GitHub. A custom upload page would need a secure backend with real login, which is not part of this site.
