"""Standard library only (unittest), no network -- see Exec-Assistant.md
section 15 ("done means") for the full test list this suite is working
toward covering.
"""
import argparse
import shutil
import sys
import tempfile
import unittest
import unittest.mock
import zipfile
from pathlib import Path

import assistant
import features
import ingest
from assistant import is_task, strip_date_phrase


class TestClassification(unittest.TestCase):
    def test_word_boundary_not_substring(self):
        # Section 4: a substring test misclassifies these two sentences as
        # tasks because "ask" sits inside "task"/"asks". Word-boundary
        # matching must not.
        self.assertFalse(is_task("the task list is long"))
        self.assertFalse(is_task("their asks are unclear"))

    def test_anywhere_verb_detected_anywhere_in_line(self):
        self.assertTrue(is_task("rotate the ping ciam client secret by friday"))

    def test_observation_vs_instruction(self):
        self.assertFalse(is_task("the pool leaks a set role across connections"))
        self.assertTrue(is_task("set the retention"))

    def test_date_phrase_only_stripped_when_resolved(self):
        title, due = strip_date_phrase("fix the loader by hand")
        self.assertEqual(title, "fix the loader by hand")
        self.assertIsNone(due)

    def test_weekday_phrase_resolves_relative_to_a_fixed_today(self):
        # A Wednesday; "by friday" should resolve 2 days out.
        today = assistant.date(2026, 8, 5)
        title, due = strip_date_phrase("send the report by friday", today=today)
        self.assertEqual(due, "2026-08-07")
        self.assertNotIn("by friday", title)

    def test_weekday_phrase_on_that_weekday_resolves_to_next_week(self):
        # A Friday; "by friday" must mean NEXT Friday, not today.
        today = assistant.date(2026, 8, 7)
        _title, due = strip_date_phrase("send the report by friday", today=today)
        self.assertEqual(due, "2026-08-14")


class TestEndOfDay(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self._orig_tasks = assistant.TASKS
        self._orig_log = assistant.LOG
        self._orig_audit = assistant.AUDIT_LOG
        assistant.TASKS = self.tmp / "tasks.md"
        assistant.LOG = self.tmp / "log"
        assistant.AUDIT_LOG = assistant.LOG / "audit.jsonl"
        features.AUDIT_LOG = assistant.AUDIT_LOG

    def tearDown(self):
        assistant.TASKS = self._orig_tasks
        assistant.LOG = self._orig_log
        assistant.AUDIT_LOG = self._orig_audit
        features.AUDIT_LOG = self._orig_audit

    def test_roll_forward_keeps_due_date_and_increments_rolled_count(self):
        assistant.TASKS.write_text(
            "## I owe\n"
            "- [ ] finish the report (due 2020-01-01) <!--abc123 2019-12-01 rolled:0-->\n"
            "\n## Waiting on\n\n## Done\n",
            encoding="utf-8",
        )
        assistant.cmd_eod(argparse.Namespace())
        text = assistant.TASKS.read_text(encoding="utf-8")
        self.assertIn("(due 2020-01-01)", text)  # the due date never moves
        self.assertIn("rolled:1", text)

    def test_unrecognized_comment_field_survives_a_roll(self):
        assistant.TASKS.write_text(
            "## I owe\n"
            "- [ ] finish the report (due 2020-01-01) <!--abc123 2019-12-01 rolled:0 foo:bar-->\n"
            "\n## Waiting on\n\n## Done\n",
            encoding="utf-8",
        )
        assistant.cmd_eod(argparse.Namespace())
        self.assertIn("foo:bar", assistant.TASKS.read_text(encoding="utf-8"))

    def test_checked_item_is_swept_into_done(self):
        assistant.TASKS.write_text(
            "## I owe\n"
            "- [x] send the invoice <!--abc123 2019-12-01 rolled:0-->\n"
            "\n## Waiting on\n\n## Done\n",
            encoding="utf-8",
        )
        assistant.cmd_eod(argparse.Namespace())
        sections = assistant._split_sections(assistant.TASKS.read_text(encoding="utf-8"))
        self.assertEqual(len(sections["## Done"]), 1)
        self.assertFalse(any(assistant.LINE_RE.match(line) for line in sections["## I owe"]))


class TestSummarizeSkipsSummaryRegion(unittest.TestCase):
    def test_read_session_skips_summary_block(self):
        tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        path = tmp / "session.md"
        path.write_text(
            "# Meeting\ndecided: ship it\n"
            f"{assistant.SUMMARY_START}\n## Summary\ndecided: ship it\n{assistant.SUMMARY_END}\n",
            encoding="utf-8",
        )
        raw = assistant.read_session(path)
        self.assertEqual(raw.count("decided: ship it"), 1)


class TestFeatures(unittest.TestCase):
    def test_anomalies_flat_series_does_not_divide_by_zero(self):
        scores = features.anomalies([5.0, 5.0, 5.0, 5.0])
        self.assertTrue(all(s == 0 for s in scores))

    def test_anomalies_flags_an_outlier(self):
        scores = features.anomalies([1.0, 1.0, 1.0, 1.0, 50.0])
        self.assertGreater(scores[-1], scores[0])

    def test_payments_uses_decimal_not_float(self):
        tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        csv_path = tmp / "payments.csv"
        csv_path.write_text("amount,units\n0.10,1\n0.20,1\n0.30,1\n", encoding="utf-8")
        result = features.payments([str(csv_path)])
        self.assertEqual(str(result["total_amount"]), "0.60")  # exact, no float drift


def _build_minimal_xlsx(path: Path, rows: list[list[str]]) -> None:
    shared_strings: list[str] = []

    def sst_index(value: str) -> int:
        if value not in shared_strings:
            shared_strings.append(value)
        return shared_strings.index(value)

    sheet_rows = []
    for r, row in enumerate(rows, start=1):
        cells = []
        for c, value in enumerate(row):
            col = chr(ord("A") + c)
            idx = sst_index(value)
            cells.append(f'<c r="{col}{r}" t="s"><v>{idx}</v></c>')
        sheet_rows.append(f'<row r="{r}">{"".join(cells)}</row>')

    sheet_xml = "<?xml version=\"1.0\"?><worksheet><sheetData>" + "".join(sheet_rows) + "</sheetData></worksheet>"
    sst_xml = "<?xml version=\"1.0\"?><sst>" + "".join(f"<si><t>{s}</t></si>" for s in shared_strings) + "</sst>"
    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr("xl/worksheets/sheet1.xml", sheet_xml)
        zf.writestr("xl/sharedStrings.xml", sst_xml)


class TestIngestXlsx(unittest.TestCase):
    def test_read_xlsx_round_trip(self):
        tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        xlsx_path = tmp / "sample.xlsx"
        _build_minimal_xlsx(xlsx_path, [["Name", "Amount"], ["Acme", "100"]])
        rows = ingest.read_xlsx(str(xlsx_path))
        self.assertEqual(rows, [["Name", "Amount"], ["Acme", "100"]])


class TestContrastAndSpecCheck(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        sys.path.insert(0, str(Path(__file__).resolve().parent / "tools"))

    def test_contrast_all_checked_tokens_pass(self):
        import contrast

        self.assertEqual(contrast.check(), [])

    def test_spec_check_commands_and_files_present(self):
        import spec_check

        self.assertEqual(spec_check.check_commands(), [])
        self.assertEqual(spec_check.check_files(), [])


class TestGuardrails(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        sys.path.insert(0, str(Path(__file__).resolve().parent / "tools"))

    def test_stdlib_only_imports_outside_tools(self):
        import guardrails

        self.assertEqual(guardrails.check_stdlib_only(), [])

    def test_no_model_provider_sdk_mentioned(self):
        import guardrails

        self.assertEqual(guardrails.check_no_model_provider_sdk(), [])

    def test_rendered_site_and_dashboard_have_no_script_style_or_on_attrs(self):
        import guardrails

        tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)

        assistant_site = tmp / "site"
        # unittest's standard-library equivalent of pytest's "monkeypatch"
        # fixture: patch.object temporarily swaps the attribute and
        # restores it automatically, even on failure.
        with unittest.mock.patch.object(assistant, "ROOT", tmp):
            assistant.cmd_site(argparse.Namespace())

        import dashboard.dashboard as dashboard_module

        dashboard_pages = dashboard_module.build(out_dir=tmp / "dashboard-site", sample_path=tmp / "missing.json")

        html_paths = list(assistant_site.glob("*.html")) + dashboard_pages
        self.assertTrue(html_paths)
        self.assertEqual(guardrails.check_no_script_in_html(html_paths), [])


if __name__ == "__main__":
    unittest.main()

