---
name: weekly-writing
description: Use when generating a new Platform Eng weekly report from the latest TikTok Agency Eng&QA weekly in a Lark Wiki, including extracting Released requirements, preserving source wording, and copying every Showcase image into a new Feishu document.
---

# Weekly writing

Generate a new Platform Eng / Agency weekly report from the latest TikTok Agency Eng&QA weekly. The source report is authoritative: preserve its requirement text, language, punctuation, formatting-relevant labels, and all Showcase images.

## Dependencies

Use the `lark-wiki` skill to locate and inspect Wiki nodes, and the `lark-doc` skill for document reads, creation, block updates, and media download. Read the relevant lark-doc reference before each operation family (`+fetch`, create, update, or media download). Use `--as user` explicitly for Lark operations.

## Workflow

1. Locate the source weekly.

   - Use the fixed Wiki directory URL: `https://bytedance.larkoffice.com/wiki/JIXjwt0h4iEtyvkV613cbuVanh2`.
   - Resolve it with `lark-cli wiki +node-get --node-token https://bytedance.larkoffice.com/wiki/JIXjwt0h4iEtyvkV613cbuVanh2 --as user --format json`.
   - List the directory's child nodes with the Wiki node-list shortcut. Find the newest page whose title is TikTok Agency Eng&QA weekly; verify recency from the page title/content rather than guessing from the current date.
   - Fetch the page with IDs. Locate the section titled `4. Released requirements / 过去一周已发布的需求` and fetch that section with IDs/XML so table rows, links, block IDs, and media tokens are retained.

2. Learn the target format.

   - Read the Agency → Updates portion of the supplied Platform Eng weekly reference document.
   - Do not edit or append to that reference document. It is only a formatting reference.
   - Create a separate blank Feishu document before writing any report content.

3. Extract every released requirement row.

   - Count all rows in the source section that belong to the weekly table; do not silently omit older-looking rows that are still inside the source weekly's released-requirements table.
   - Start each requirement with the original Meego URL as the first bullet. Let Feishu resolve the link name; do not invent a title or copy the owner/date fields.
   - Omit owner, release date, and Summary.
   - Copy Intro/Background, Background, Benefits/Benefit, Protection Plan labels, and description text exactly as written in the source. Preserve the source language; translate nothing and paraphrase nothing.
   - Keep source punctuation, spacing when meaningful, capitalization, typos, bold spans inside body text, nested metric bullets, and source links/citations when they are safe to reproduce.
   - The requirement title is a first-level bullet. Nest its `Background` label and body one level under that title. Keep the rest of the report's bullet hierarchy consistent with the Agency Updates reference and the user's latest formatting preference. Background subheadings are plain text, not bold.

4. Preserve Showcase media.

   - Enumerate every source image in each Showcase, including images inside grids and nested subsections. Preserve source order and the exact count.
   - For internal Lark media, download each source media token locally with `lark-cli docs +media-download`, using paths relative to the command CWD. Insert local files with XML such as `<img path="@./source_assets/image.png"/>`; this avoids broken cross-document media relationships.
   - If a source image already exists in the new document, do not duplicate it. Verify the final per-requirement and total image counts against the source.

5. Write and verify the new document.

   - Use targeted `lark-cli docs +update` block operations after the blank document is created. Refetch with IDs after structural edits; block IDs can change after replacement.
   - Never overwrite the Platform Eng reference weekly or the Agency source weekly.
   - Verify all of the following before handing off:
     - the new document URL is the only report output;
     - the number of Meego requirement links equals the source table row count;
     - every source description is present verbatim, without translated or generated prose;
     - every source Showcase image is present exactly once and in source order;
     - each Background is one bullet level below its requirement title;
     - owner, release date, and Summary are absent;
     - the source and reference documents were not modified.

## Safety and blocked content

If the source contains a citation to a separate private document, do not expose that private document's access entry in the new report without explicit user authorization. Preserve the visible label where possible and report the omitted citation clearly. Do not work around an access or permission block by copying private URLs through another field.

If the source weekly or its released-requirements section cannot be identified confidently, stop and report the ambiguity rather than generating from an older page or guessing requirement content.
