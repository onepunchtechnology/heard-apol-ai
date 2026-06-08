import sys
import os
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from guardrails import check, MAX_REPLY_CHARS, MIN_REPLY_CHARS


class TestGuardrailsLength(unittest.TestCase):
    def test_clean_reply_passes(self):
        result = check("Thank you so much for your order! We're glad you loved it.")
        self.assertTrue(result.passed)
        self.assertEqual([], result.fired_flags)

    def test_too_short_fails(self):
        result = check("OK")
        self.assertFalse(result.passed)
        self.assertIn('reply_too_short', result.fired_flags)

    def test_exact_min_length_passes(self):
        reply = "A" * MIN_REPLY_CHARS
        result = check(reply)
        self.assertNotIn('reply_too_short', result.fired_flags)

    def test_one_below_min_fails(self):
        reply = "A" * (MIN_REPLY_CHARS - 1)
        result = check(reply)
        self.assertIn('reply_too_short', result.fired_flags)

    def test_exact_max_length_passes(self):
        reply = "A" * MAX_REPLY_CHARS
        result = check(reply)
        self.assertNotIn('reply_too_long', result.fired_flags)

    def test_one_over_max_fails(self):
        reply = "A" * (MAX_REPLY_CHARS + 1)
        result = check(reply)
        self.assertFalse(result.passed)
        self.assertIn('reply_too_long', result.fired_flags)

    def test_empty_string_fails(self):
        result = check("")
        self.assertFalse(result.passed)
        self.assertIn('reply_too_short', result.fired_flags)

    def test_whitespace_only_fails(self):
        result = check("   \n\t  ")
        self.assertFalse(result.passed)
        self.assertIn('reply_too_short', result.fired_flags)


class TestGuardrailsProhibitedPatterns(unittest.TestCase):
    BASE = "Thank you for your review. We appreciate your feedback and will look into this right away."

    def _wrap(self, phrase):
        return f"{self.BASE} {phrase}"

    def test_unconditional_promise_guarantee(self):
        result = check(self._wrap("We guarantee your satisfaction."))
        self.assertFalse(result.passed)
        self.assertIn('unconditional_promise', result.fired_flags)

    def test_unconditional_promise_100_percent(self):
        result = check(self._wrap("We are 100% committed to you."))
        self.assertFalse(result.passed)
        self.assertIn('unconditional_promise', result.fired_flags)

    def test_unconditional_promise_always(self):
        result = check(self._wrap("We always deliver on time."))
        self.assertFalse(result.passed)
        self.assertIn('unconditional_promise', result.fired_flags)

    def test_refund_offer(self):
        result = check(self._wrap("Please reach out for a refund."))
        self.assertFalse(result.passed)
        self.assertIn('refund_offer', result.fired_flags)

    def test_refund_offer_money_back(self):
        result = check(self._wrap("We offer a full money back policy."))
        self.assertFalse(result.passed)
        self.assertIn('refund_offer', result.fired_flags)

    def test_refund_offer_compensation(self):
        result = check(self._wrap("We will provide compensation for the issue."))
        self.assertFalse(result.passed)
        self.assertIn('refund_offer', result.fired_flags)

    def test_competitor_mention(self):
        result = check(self._wrap("Unlike our competitor we ship fast."))
        self.assertFalse(result.passed)
        self.assertIn('competitor_mention', result.fired_flags)

    def test_phone_number_pii_dashes(self):
        result = check(self._wrap("Call us at 555-123-4567 anytime."))
        self.assertFalse(result.passed)
        self.assertIn('phone_number_pii', result.fired_flags)

    def test_phone_number_pii_dots(self):
        result = check(self._wrap("Reach us at 555.123.4567."))
        self.assertFalse(result.passed)
        self.assertIn('phone_number_pii', result.fired_flags)

    def test_phone_number_pii_plain(self):
        result = check(self._wrap("Call 5551234567."))
        self.assertFalse(result.passed)
        self.assertIn('phone_number_pii', result.fired_flags)

    def test_email_pii(self):
        result = check(self._wrap("Email us at support@ohayopop.com."))
        self.assertFalse(result.passed)
        self.assertIn('email_pii', result.fired_flags)

    def test_unsolicited_promo_free(self):
        result = check(self._wrap("We will send you something free."))
        self.assertFalse(result.passed)
        self.assertIn('unsolicited_promo', result.fired_flags)

    def test_unsolicited_promo_discount_code(self):
        result = check(self._wrap("Use this discount code for 10% off."))
        self.assertFalse(result.passed)
        self.assertIn('unsolicited_promo', result.fired_flags)

    def test_unsolicited_promo_promo_code(self):
        result = check(self._wrap("Here is a promo code: SAVE10."))
        self.assertFalse(result.passed)
        self.assertIn('unsolicited_promo', result.fired_flags)

    def test_profanity(self):
        result = check(self._wrap("This is damn good service."))
        self.assertFalse(result.passed)
        self.assertIn('profanity', result.fired_flags)


class TestGuardrailsCaseInsensitivity(unittest.TestCase):
    BASE = "Thank you for your review. We appreciate your feedback and will look into this right away."

    def test_refund_uppercase(self):
        result = check(f"{self.BASE} REFUND available on request.")
        self.assertIn('refund_offer', result.fired_flags)

    def test_guarantee_mixed_case(self):
        result = check(f"{self.BASE} We Guarantee this.")
        self.assertIn('unconditional_promise', result.fired_flags)

    def test_email_mixed_case(self):
        result = check(f"{self.BASE} Contact Help@OhayoPop.COM.")
        self.assertIn('email_pii', result.fired_flags)


class TestGuardrailsMultipleViolations(unittest.TestCase):
    def test_multiple_flags_all_reported(self):
        reply = (
            "We guarantee a refund. Call 555-123-4567 or email us@store.com. "
            "Use promo code FREE10 for savings."
        )
        result = check(reply)
        self.assertFalse(result.passed)
        self.assertGreater(len(result.fired_flags), 1)
        self.assertIn('unconditional_promise', result.fired_flags)
        self.assertIn('refund_offer', result.fired_flags)
        self.assertIn('phone_number_pii', result.fired_flags)
        self.assertIn('email_pii', result.fired_flags)
        self.assertIn('unsolicited_promo', result.fired_flags)

    def test_reason_contains_all_flags(self):
        reply = "We guarantee a refund. Call 555-123-4567."
        result = check(reply)
        for flag in result.fired_flags:
            self.assertIn(flag, result.reason)

    def test_passed_false_when_any_flag(self):
        result = check("We guarantee this.")
        self.assertFalse(result.passed)
        self.assertNotEqual('', result.reason)


class TestGuardrailsCleanReplies(unittest.TestCase):
    def test_typical_positive_reply(self):
        reply = (
            "Arigatou, Mei! It makes us so happy to hear you are loving your order. "
            "Thank you for being part of the OhayoPop community. We hope to see you again soon!"
        )
        result = check(reply)
        self.assertTrue(result.passed)
        self.assertEqual([], result.fired_flags)

    def test_typical_negative_reply(self):
        reply = (
            "Hi Tyler, we are so sorry to hear your figure arrived damaged. "
            "This is not the standard we hold ourselves to. "
            "Please reach out to our support team and we will make this right."
        )
        # 'reach out' does not match refund pattern; no prohibited phrases
        result = check(reply)
        self.assertTrue(result.passed)

    def test_reply_mentioning_support_email_in_narrative(self):
        # Only a literal email address triggers email_pii, not the word "email"
        reply = (
            "Thank you for your patience. Please email our support team "
            "through the contact form on our website and we will help you out."
        )
        result = check(reply)
        self.assertTrue(result.passed)


class TestGuardrailsFalsePositives(unittest.TestCase):
    """Phrases that are common in legitimate customer service replies but look
    superficially like prohibited patterns. Each test encodes what SHOULD pass."""

    def test_feel_free_does_not_trigger_promo(self):
        # "feel free" is idiomatic customer service language, not a promo offer
        reply = (
            "Thank you for your feedback! Please feel free to reach out to our "
            "support team and we will make this right for you."
        )
        result = check(reply)
        self.assertNotIn('unsolicited_promo', result.fired_flags)
        self.assertTrue(result.passed)

    def test_free_to_contact_does_not_trigger_promo(self):
        reply = (
            "Hi there! We appreciate you sharing your experience. "
            "You are free to contact us any time through our website chat."
        )
        result = check(reply)
        self.assertNotIn('unsolicited_promo', result.fired_flags)

    def test_reach_out_does_not_trigger_refund(self):
        # "reach out" should not match the refund pattern
        reply = (
            "We're so sorry to hear this! Please reach out to our support team "
            "and we will do our best to help."
        )
        result = check(reply)
        self.assertNotIn('refund_offer', result.fired_flags)
        self.assertTrue(result.passed)

    def test_make_this_right_does_not_trigger_refund(self):
        reply = (
            "Hi Sarah, thank you for letting us know. We want to make this right "
            "for you — please contact us through the order page."
        )
        result = check(reply)
        self.assertNotIn('refund_offer', result.fired_flags)
        self.assertTrue(result.passed)

    def test_ass_substring_in_word_does_not_trigger_profanity(self):
        # "class", "assistance", "pass" contain 'ass' but are not profanity
        reply = (
            "Thank you for your kind words about our customer service class! "
            "We are happy to be of assistance and hope to see you again."
        )
        result = check(reply)
        self.assertNotIn('profanity', result.fired_flags)
        self.assertTrue(result.passed)

    def test_better_in_person_than_photos_does_not_trigger_competitor(self):
        reply = (
            "Arigatou, Mei! We are so happy the Miku figure looks even better "
            "in person than in the photos. Thank you for ordering with us again."
        )
        result = check(reply)
        self.assertNotIn('competitor_mention', result.fired_flags)
        self.assertTrue(result.passed)

    def test_try_product_name_does_not_trigger_competitor(self):
        reply = (
            "Arigatou, Mei! We are so happy you loved this order. "
            "We cannot wait for you to try Miku in your collection."
        )
        result = check(reply)
        self.assertNotIn('competitor_mention', result.fired_flags)
        self.assertTrue(result.passed)


if __name__ == '__main__':
    unittest.main()
