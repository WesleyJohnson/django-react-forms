# Security

Please report vulnerabilities privately (a GitHub security advisory on this repository) rather than
in a public issue. I'll acknowledge reports within a few days and aim to fix confirmed issues
promptly.

This library takes untrusted input in two places worth knowing about:

- Form data is embedded in an inline `<script>` on the page. `<`, `>`, `&` and the Unicode line
  separators are escaped so a value can't end the script block.
- Rich text HTML from the Quill add-on is produced in the browser. It is sanitized when saved and
  must be sanitized again when rendered (`{{ value|rich_text }}`).
