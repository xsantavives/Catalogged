"""Offline regression tests for XSV Review Budget Gate."""
import unittest
from review_budget import Blocked, advance, empty, pack, unpack, validate

REPO = 'xsantavives/Selthru'
ISSUE = 'XSV-162'
SHA1 = 'a' * 40
SHA2 = 'b' * 40

class BudgetTests(unittest.TestCase):
    def setUp(self):
        self.s = empty(REPO, 51, ISSUE)

    def do(self, operation, sha=SHA1, run='1-1', reservation='', verdict='', reviewed=False):
        self.s = advance(self.s,operation,sha,run,reservation,verdict,
                         '123' if reviewed else '', {'id':123} if reviewed else None)

    def complete_first(self):
        self.do('reserve-review')
        self.do('finish-review', reservation='1-1',verdict='CHANGES_REQUESTED',reviewed=True)

    def test_complete_two_reviews_one_repair(self):
        self.complete_first()
        self.do('reserve-repair', run='2-1')
        self.do('finish-repair', sha=SHA2, reservation='2-1')
        self.do('reserve-review', sha=SHA2, run='3-1')
        self.do('finish-review', sha=SHA2, reservation='3-1',
                verdict='ACCEPTED_FOR_OWNER_GATE', reviewed=True)
        self.assertEqual((self.s['review_rounds'],self.s['repair_rounds']),(2,1))
        with self.assertRaises(Blocked):
            self.do('reserve-review',sha=SHA2,run='4-1')

    def test_second_review_requests_changes_is_forced_human_gate(self):
        self.complete_first()
        self.do('reserve-repair',run='2-1')
        self.do('finish-repair',sha=SHA2,reservation='2-1')
        self.do('reserve-review',sha=SHA2,run='3-1')
        self.do('finish-review',sha=SHA2,reservation='3-1',verdict='CHANGES_REQUESTED',reviewed=True)
        self.assertEqual(self.s['last_verdict'],'BLOCKED_HUMAN_DECISION_REQUIRED')

    def test_parallel_or_duplicate_attempts_block(self):
        self.do('reserve-review')
        with self.assertRaises(Blocked):
            self.do('reserve-review',run='2-1')
        with self.assertRaises(Blocked):
            self.do('finish-review',reservation='bad',verdict='CHANGES_REQUESTED',reviewed=True)

    def test_head_change_during_review_blocks(self):
        self.do('reserve-review')
        with self.assertRaises(Blocked):
            self.do('finish-review',sha=SHA2,reservation='1-1',
                    verdict='CHANGES_REQUESTED',reviewed=True)

    def test_repair_requires_first_review_failure(self):
        self.do('reserve-review')
        self.do('finish-review',reservation='1-1',verdict='ACCEPTED_FOR_OWNER_GATE',reviewed=True)
        with self.assertRaises(Blocked): self.do('reserve-repair',run='2-1')

    def test_duplicate_reservation_id_blocks(self):
        self.complete_first()
        with self.assertRaises(Blocked): self.do('reserve-repair',run='1-1')

    def test_final_review_requires_published_evidence(self):
        self.do('reserve-review')
        with self.assertRaises(Blocked):
            self.do('finish-review',reservation='1-1',verdict='CHANGES_REQUESTED')

    def test_counter_cannot_disagree_with_events(self):
        self.do('reserve-review')
        self.s['review_rounds']=0
        with self.assertRaises(Blocked): validate(self.s,REPO,51,ISSUE)

    def test_wrong_issue_blocks(self):
        with self.assertRaises(Blocked): validate(self.s,REPO,51,'XSV-149')

    def test_roundtrip(self):
        self.assertEqual(self.s,unpack(pack(self.s)))

    def test_interrupted_review_stays_reserved(self):
        self.do('reserve-review')
        with self.assertRaises(Blocked): self.do('reserve-repair',run='2-1')

    def test_new_sha_does_not_reset_budget(self):
        self.complete_first()
        with self.assertRaises(Blocked): self.do('reserve-review',sha=SHA2,run='2-1')

    def test_review_capacity_max_two(self):
        self.complete_first()
        self.do('reserve-repair',run='2-1')
        self.do('finish-repair',sha=SHA2,reservation='2-1')
        self.do('reserve-review',sha=SHA2,run='3-1')
        with self.assertRaises(Blocked): self.do('reserve-review',sha=SHA2,run='4-1')

if __name__ == '__main__':
    unittest.main()
