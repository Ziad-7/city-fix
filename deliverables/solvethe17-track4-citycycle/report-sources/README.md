# Editable report sources and export

From the repository root, use Python 3.12+ and Chromium. No service credentials or network requests to the deployed apps are needed.

```sh
python -m venv /tmp/cityfix-report-env
/tmp/cityfix-report-env/bin/pip install -r deliverables/solvethe17-track4-citycycle/report-sources/requirements.txt
/tmp/cityfix-report-env/bin/python deliverables/solvethe17-track4-citycycle/report-sources/build_reports.py --chromium /usr/bin/chromium
```

Adjust executable paths for your operating system. If using Playwright's own browser, install it with `python -m playwright install chromium` and omit `--chromium`. Linux Chromium may also require OS packages. The exporter uses `--no-sandbox` for compatibility with the managed workspace; use it only with these trusted local report sources.

The exporter reads the original supplier BOM, creates the sourced estimate and cost report, converts [technical Markdown](../TECHNICAL-DOCUMENTATION.md) to HTML, embeds diagrams, and prints the technical, field and A3 circuit PDFs. It asserts that the field brief has exactly two pages and that required text is present. The presentation is not regenerated or modified. No video is generated.

- `field-brief.html`: editable, self-contained two-page report source.
- `build_reports.py`: price calculations and PDF export.
- `technical-documentation.html`: generated, self-contained HTML; edit the Markdown instead.

Inspect the PDFs visually after regeneration; page-count checks alone cannot prove layout quality. Re-run the local prototype checks in [VERIFICATION.md](../VERIFICATION.md) if the software/hardware source changed.
