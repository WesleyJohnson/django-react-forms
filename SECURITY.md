# Security

Please report vulnerabilities privately (a GitHub security advisory on this repository) rather than
in a public issue. I'll acknowledge reports within a few days and aim to fix confirmed issues
promptly.

This library takes untrusted input in two places worth knowing about:

- Form data is embedded in an inline `<script>` on the page. `<`, `>`, `&` and the Unicode line
  separators are escaped so a value can't end the script block.
- Rich text HTML from the Quill add-on is produced in the browser. It is sanitized when saved and
  must be sanitized again when rendered (`{{ value|rich_text }}`).
- Quill 2.0.3 has an advisory (GHSA-v3m3-f69x-jf25) about its HTML *export* feature. This library
  doesn't use it: the editor reads `quill.root.innerHTML`, and the server sanitizes that on save
  and on render. The peer range still allows 2.0.3; the development copy is pinned to 2.0.2.
