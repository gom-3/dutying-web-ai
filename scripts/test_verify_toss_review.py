"""Contract checks for the read-only Toss review preflight."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('verify_toss_review', Path(__file__).with_name('verify-toss-review.py'))
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


class OfferChecks(unittest.TestCase):
    def offer(self, **changes):
        return dict(plan='PLUS', baseGross=19900, includedStaff=50,
                    extraStaffGross=990, generate=30, adjust=10, adminSeats=10,
                    maxChargeGross=1000000, currency='KRW',
                    termsVersion='plus-monthly-2026-10-11', priceVersion='published-v1',
                    ready=True, **changes)

    def test_operator_price_and_allowance_changes_are_valid(self):
        offer = self.offer()
        offer.update(baseGross=29900, includedStaff=80, extraStaffGross=1200,
                     generate=60, adjust=0, adminSeats=20)
        self.assertEqual(verifier.offer_errors(offer, True), [])

    def test_unknown_or_missing_policy_reports_one_setup_reason(self):
        for code in ('COMMERCIAL_NOT_ENABLED', 'POLICY_NOT_CONFIGURED'):
            with self.subTest(code=code):
                errors = verifier.offer_errors({'ready': False, 'code': code})
                self.assertEqual(len(errors), 1)
                self.assertIn(code, errors[0])

    def test_invalid_numeric_values_never_look_ready(self):
        for field, value in [('baseGross', True), ('includedStaff', 0), ('adjust', -1),
                             ('generate', 1.2), ('extraStaffGross', '990'),
                             ('adminSeats', 2**54), ('baseGross', 1000001)]:
            with self.subTest(field=field, value=value):
                offer = self.offer()
                offer[field] = value
                self.assertTrue(verifier.offer_errors(offer, True))

    def test_unready_price_is_readable_but_not_payment_ready(self):
        offer = self.offer()
        offer.update(ready=False, code='PAYMENT_NOT_CONFIGURED')
        self.assertEqual(verifier.offer_errors(offer), [])
        self.assertIn('PAYMENT_NOT_CONFIGURED', ';'.join(verifier.offer_errors(offer, True)))

    def test_contract_invariants_and_version_are_required(self):
        for field, value in [('plan', 'HOSPITAL'), ('currency', 'USD'),
                             ('maxChargeGross', 2000000), ('priceVersion', ''),
                             ('termsVersion', ''), ('ready', 'true')]:
            with self.subTest(field=field):
                offer = self.offer()
                offer[field] = value
                self.assertTrue(verifier.offer_errors(offer, True))

    def test_non_object_response_is_rejected(self):
        for payload in (None, [], 'unavailable'):
            self.assertEqual(verifier.offer_errors(payload), ['JSON object required'])


if __name__ == '__main__':
    unittest.main()
