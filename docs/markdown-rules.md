# Markdown Rules

## Scope and intent

- These rules define a consistent, accessible, and maintainable Markdown style for this project.
- They apply to all Markdown documents unless a file explicitly states an exception.

## Headings

- Each document must start with a single level-1 heading (H1) that is the document title.
- Do not skip heading levels: H1 → H2 → H3, etc. Never jump from H1 to H3.
- Always add one blank line after a heading.
- Keep headings concise and descriptive. Prefer sentence case or title case consistently within a document.

## Spacing and line breaks

- Add a blank line between logical blocks: after headings, before and after lists, tables, blockquotes, and code blocks.
- Do not use multiple consecutive blank lines (MD012).
- Avoid trailing spaces at the end of lines.

## Lists

- Use `-` for unordered lists and maintain consistent list markers within a document.
- For ordered lists, use `1.` on every line or proper incremental numbering; both render correctly, choose one style per document.
- Indent nested list items by two spaces under the first character of the parent text for clear hierarchy.

## Code blocks and inline code

- Use fenced code blocks with triple backticks. Specify the language when possible (e.g., ` ```js `).
- Use inline code backticks for file names, commands, and identifiers that benefit from monospaced styling.

## Links and images

- Prefer descriptive link text: `[Install Meteor](https://www.meteor.com/)` rather than bare URLs.
- Provide alt text for images: `![Hex tile placeholder](public/hex.png)`.

## Blockquotes and callouts

- Use `>` for blockquotes. Keep them short and relevant.

## Horizontal rules

- Use three dashes `---` on a single line, with blank lines surrounding the rule.

## Tables

- Use header separators with dashes and colons for alignment. Keep tables readable; break long content into lists where appropriate.

## File structure and metadata

- One H1 per file. Use subsequent headings in order without skipping levels.
- Keep documents code-free unless the file’s purpose is to show examples or code snippets (e.g., README, guides). The `context/context.md` file must remain code-free.
- Use English for technical documents and artifacts.

## Linting and references

- Prefer de facto standards from CommonMark and Markdownlint (MD rules) regarding headings and spacing.
- References:
  - CommonMark specification: `https://spec.commonmark.org/`
  - Markdown Guide (basic syntax): `https://www.markdownguide.org/basic-syntax/`
  - Markdownlint rule set: `https://github.com/DavidAnson/markdownlint/blob/main/doc/Rules.md`
