import unittest

from src.signup import validate_signup

VALID = {
    'username': 'river_7', 'email': 'river@example.com', 'password': 'blue-otter-42', 'confirm': 'blue-otter-42',
    'age': '29', 'country': 'US', 'postcode': '94105',
}


class SignupTest(unittest.TestCase):
    def test_a_valid_form_has_no_errors(self):
        self.assertEqual(validate_signup(VALID), [])

    def test_an_empty_form_lists_required_fields_in_order(self):
        self.assertEqual(
            validate_signup({}),
            ['username.required', 'email.required', 'password.required', 'age.required', 'country.required'],
        )

    def test_username_rules(self):
        self.assertEqual(validate_signup({**VALID, 'username': 'ab'}), ['username.length'])
        self.assertEqual(validate_signup({**VALID, 'username': 'River'}), ['username.chars'])
        self.assertEqual(validate_signup({**VALID, 'username': '7river'}), ['username.start'])
        self.assertEqual(validate_signup({**VALID, 'username': ' admin '}), ['username.reserved'])

    def test_password_and_confirmation(self):
        self.assertEqual(validate_signup({**VALID, 'password': 'short1', 'confirm': 'short1'}), ['password.length'])
        self.assertEqual(validate_signup({**VALID, 'password': 'onlyletters', 'confirm': 'x'}), ['password.weak', 'confirm.mismatch'])
        self.assertEqual(validate_signup({**VALID, 'password': 'my-river_7-pw', 'confirm': 'my-river_7-pw'}), ['password.username'])

    def test_postcodes_per_country(self):
        self.assertEqual(validate_signup({**VALID, 'postcode': '94105-1234'}), [])
        self.assertEqual(validate_signup({**VALID, 'country': 'ca', 'postcode': 'k1a 0b1'}), [])
        self.assertEqual(validate_signup({**VALID, 'country': 'GB', 'postcode': 'SW1A 1AA'}), [])
        self.assertEqual(validate_signup({**VALID, 'country': 'DE', 'postcode': '1011'}), ['postcode.format'])
        self.assertEqual(validate_signup({**VALID, 'country': 'FR', 'postcode': '75001'}), ['country.unsupported'])

    def test_age_and_referral(self):
        self.assertEqual(validate_signup({**VALID, 'age': '12'}), ['age.minimum'])
        self.assertEqual(validate_signup({**VALID, 'age': '12.5'}), ['age.invalid'])
        self.assertEqual(validate_signup({**VALID, 'referral': 'REF-AB12CD'}), [])
        self.assertEqual(validate_signup({**VALID, 'referral': 'REF-ab12cd'}), ['referral.format'])


if __name__ == '__main__':
    unittest.main()
