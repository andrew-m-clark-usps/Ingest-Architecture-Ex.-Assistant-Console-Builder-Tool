"""DEMO/REFERENCE SCAFFOLD test suite. Standard library only (unittest), no
network -- see Exec-Assistant.md section 15 ("done means") for the full
test list this scaffold does not yet cover in full.
"""
import unittest

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


if __name__ == "__main__":
    unittest.main()
