"""Characterization tests: the refactored validate_signup must answer exactly like the original,
kept below as legacy_validate, on chosen edge cases and on thousands of generated forms."""
import random
import unittest

from src.signup import validate_signup

RESERVED = ['admin', 'root', 'support', 'help', 'system']
DISPOSABLE = ['mailinator.com', 'tempmail.dev', 'throwaway.email']
COUNTRIES = ['US', 'CA', 'GB', 'DE', 'CN']


def legacy_validate(form):
    """The starting code, kept as the reference."""
    errors = []

    # username
    username = form.get('username')
    if username is None or username.strip() == '':
        errors.append('username.required')
    else:
        username = username.strip()
        if len(username) < 3 or len(username) > 20:
            errors.append('username.length')
        else:
            bad = False
            for ch in username:
                if not (ch in '0123456789' or ch == '_' or ('a' <= ch <= 'z')):
                    bad = True
            if bad:
                errors.append('username.chars')
            elif not ('a' <= username[0] <= 'z'):
                errors.append('username.start')
            elif username in RESERVED:
                errors.append('username.reserved')

    # email
    email = form.get('email')
    if email is None or email.strip() == '':
        errors.append('email.required')
    else:
        email = email.strip().lower()
        if email.count('@') != 1:
            errors.append('email.format')
        else:
            local = email.split('@')[0]
            domain = email.split('@')[1]
            if local == '' or domain == '' or '.' not in domain or domain.startswith('.') or domain.endswith('.') or ' ' in email:
                errors.append('email.format')
            else:
                if domain in DISPOSABLE:
                    errors.append('email.disposable')

    # password
    password = form.get('password')
    if password is None or password == '':
        errors.append('password.required')
    else:
        if len(password) < 10:
            errors.append('password.length')
        else:
            has_letter = False
            has_digit = False
            for ch in password:
                if ch.isalpha():
                    has_letter = True
                if ch in '0123456789':
                    has_digit = True
            if not has_letter or not has_digit:
                errors.append('password.weak')
            else:
                if username is not None and username.strip() != '' and username.strip().lower() in password.lower():
                    errors.append('password.username')
        confirm = form.get('confirm')
        if confirm is None or confirm != password:
            errors.append('confirm.mismatch')

    # age
    age = form.get('age')
    if age is None or age.strip() == '':
        errors.append('age.required')
    else:
        age = age.strip()
        digits = True
        for ch in age:
            if ch not in '0123456789':
                digits = False
        if not digits:
            errors.append('age.invalid')
        else:
            if int(age) < 13:
                errors.append('age.minimum')
            elif int(age) > 120:
                errors.append('age.range')

    # country and postcode
    country = form.get('country')
    if country is None or country.strip() == '':
        errors.append('country.required')
    else:
        country = country.strip().upper()
        if country not in COUNTRIES:
            errors.append('country.unsupported')
        else:
            postcode = form.get('postcode')
            if postcode is None or postcode.strip() == '':
                errors.append('postcode.required')
            else:
                postcode = postcode.strip().upper()
                if country == 'US':
                    ok = False
                    if len(postcode) == 5:
                        ok = True
                        for ch in postcode:
                            if ch not in '0123456789':
                                ok = False
                    if len(postcode) == 10 and postcode[5] == '-':
                        ok = True
                        for ch in postcode[:5] + postcode[6:]:
                            if ch not in '0123456789':
                                ok = False
                    if not ok:
                        errors.append('postcode.format')
                elif country == 'DE':
                    ok = False
                    if len(postcode) == 5:
                        ok = True
                        for ch in postcode:
                            if ch not in '0123456789':
                                ok = False
                    if not ok:
                        errors.append('postcode.format')
                elif country == 'CN':
                    ok = False
                    if len(postcode) == 6:
                        ok = True
                        for ch in postcode:
                            if ch not in '0123456789':
                                ok = False
                    if not ok:
                        errors.append('postcode.format')
                elif country == 'CA':
                    compact = postcode.replace(' ', '')
                    ok = len(compact) == 6
                    if ok:
                        for i in range(6):
                            if i % 2 == 0 and not ('A' <= compact[i] <= 'Z'):
                                ok = False
                            if i % 2 == 1 and compact[i] not in '0123456789':
                                ok = False
                    if not ok:
                        errors.append('postcode.format')
                else:
                    # GB: an outward code, one space, then a digit and two letters
                    parts = postcode.split(' ')
                    ok = len(parts) == 2 and 2 <= len(parts[0]) <= 4 and len(parts[1]) == 3
                    if ok:
                        if not ('A' <= parts[0][0] <= 'Z'):
                            ok = False
                        for ch in parts[0]:
                            if not ('A' <= ch <= 'Z' or ch in '0123456789'):
                                ok = False
                        if parts[1][0] not in '0123456789' or not ('A' <= parts[1][1] <= 'Z') or not ('A' <= parts[1][2] <= 'Z'):
                            ok = False
                    if not ok:
                        errors.append('postcode.format')

    # referral code (optional)
    referral = form.get('referral')
    if referral is not None and referral.strip() != '':
        referral = referral.strip()
        if len(referral) != 10 or not referral.startswith('REF-'):
            errors.append('referral.format')
        else:
            for ch in referral[4:]:
                if not ('A' <= ch <= 'Z' or ch in '0123456789'):
                    errors.append('referral.format')
                    break

    return errors


VALID = {
    'username': 'river_7', 'email': 'river@example.com', 'password': 'blue-otter-42', 'confirm': 'blue-otter-42',
    'age': '29', 'country': 'US', 'postcode': '94105',
}
POOLS = {
    'username': [None, '', '   ', 'ab', 'abc', ' abc ', 'a' * 20, 'a' * 21, 'Abc', 'abc-d', 'abc d', '9abc', '_abc',
                 'admin', 'Admin', 'admins', 'root', 'x__1', 'zz9', 'é_bc', 'abc\t', 'tab\tbed', 'ab١'],
    'email': [None, '', ' ', 'a@b.co', ' A@B.CO ', 'a@@b.co', 'ab.co', '@b.co', 'a@', 'a@bco', 'a@.b.co', 'a@b.co.',
              'a b@c.co', 'a\tb@c.co', 'x@mailinator.com', 'X@MAILINATOR.COM', 'x@sub.mailinator.com', 'x@tempmail.dev',
              'x@throwaway.email', 'x@example.com '],
    'password': [None, '', ' ', 'short1', 'abcdefghi1', 'abcdefghij', '1234567890', '          ', 'pässwörd99',
                 'river_7river7', 'RIVER_7xxxx1', 'xxriver_71xx', 'abc def gh1', '١٢٣٤٥٦٧٨٩٠abc', 'abcdefghi²'],
    'confirm': [None, '', 'blue-otter-42', 'abcdefghi1', 'river_7river7'],
    'age': [None, '', ' ', '12', '13', ' 13 ', '120', '121', '0', '0013', '-5', '1e2', '12.5', 'abc', '١٣', '99999999999999999999'],
    'country': [None, '', ' ', 'US', 'us', ' us ', 'CA', 'GB', 'gb', 'DE', 'CN', 'FR', 'USA', 'U S'],
    'postcode': [None, '', ' ', '94105', '9410', '941055', '94105-1234', '94105 1234', '94105-123', 'abcde', '١٢٣٤٥',
                 '10115', '100000', '10000a', 'K1A 0B1', 'k1a0b1', 'K 1 A 0 B 1', 'K1A-0B1', '1KA 0B1',
                 'SW1A 1AA', 'sw1a 1aa', 'M1 1AE', 'M1  1AE', 'SW1A1AA', 'EC1A 1BB', 'W1 1A', '1W 1AA', 'SW1A 1A1', 'ABCDE 1AA'],
    'referral': [None, '', '  ', 'REF-ABC123', ' REF-ABC123 ', 'ref-ABC123', 'REF-abc123', 'REF-ABC12', 'REF-ABC1234',
                 'REF_ABC123', 'REF-ABC-23', 'REF-ÄBC123'],
}


def form_with(**fields):
    form = dict(VALID)
    for key, value in fields.items():
        if value is None:
            form.pop(key, None)
        else:
            form[key] = value
    return form


class SignupCharacterizationTest(unittest.TestCase):
    def check(self, form):
        self.assertEqual(validate_signup(dict(form)), legacy_validate(dict(form)), form)

    def test_known_answers(self):
        self.assertEqual(validate_signup(VALID), [])
        self.assertEqual(validate_signup({}), ['username.required', 'email.required', 'password.required', 'age.required', 'country.required'])
        self.assertEqual(validate_signup(form_with(username='Root', password='short')), ['username.chars', 'password.length', 'confirm.mismatch'])
        self.assertEqual(validate_signup(form_with(country='ca', postcode='k1a 0b1', referral='REF-7Q2Z9X')), [])
        self.assertEqual(validate_signup(form_with(country='GB', postcode='SW1A  1AA')), ['postcode.format'])

    def test_each_username(self):
        for value in POOLS['username']:
            self.check(form_with(username=value))
            self.check(form_with(username=value, password='xx' + (value or '').strip().upper() + '9xxxxxxxx'))

    def test_each_email(self):
        for value in POOLS['email']:
            self.check(form_with(email=value))

    def test_each_password_and_confirmation(self):
        for value in POOLS['password']:
            for confirm in POOLS['confirm'] + [value]:
                self.check(form_with(password=value, confirm=confirm))

    def test_each_age(self):
        for value in POOLS['age']:
            self.check(form_with(age=value))

    def test_each_country_and_postcode(self):
        for country in POOLS['country']:
            for postcode in POOLS['postcode']:
                self.check(form_with(country=country, postcode=postcode))

    def test_each_referral(self):
        for value in POOLS['referral']:
            self.check(form_with(referral=value))

    def test_generated_forms(self):
        rng = random.Random(20261015)
        for _ in range(4000):
            form = {}
            for key, pool in POOLS.items():
                value = rng.choice(pool)
                if value is not None and rng.random() < 0.9:
                    form[key] = value
            self.check(form)

    def test_the_form_is_left_as_it_was(self):
        form = form_with(username=' River_7 ', email=' X@Y.CO ', postcode=' 94105 ')
        before = dict(form)
        validate_signup(form)
        self.assertEqual(form, before)


if __name__ == '__main__':
    unittest.main()
