"""Signup form checks for the account service.

The web and mobile clients show a message per error code and the growth dashboards count them,
so the codes, and their order, must not change.
"""
import re

RESERVED = {'admin', 'root', 'support', 'help', 'system'}
DISPOSABLE = {'mailinator.com', 'tempmail.dev', 'throwaway.email'}
DIGITS = '0123456789'
USERNAME = re.compile(r'[a-z][a-z0-9_]*')
REFERRAL = re.compile(r'REF-[A-Z0-9]{6}')
# Matched against the trimmed, upper-cased postcode; Canada's ignores spaces.
POSTCODES = {
    'US': re.compile(r'[0-9]{5}(?:-[0-9]{4})?'),
    'CA': re.compile(r'(?:[A-Z][0-9]){3}'),
    'GB': re.compile(r'[A-Z][A-Z0-9]{1,3} [0-9][A-Z]{2}'),
    'DE': re.compile(r'[0-9]{5}'),
    'CN': re.compile(r'[0-9]{6}'),
}


def validate_signup(form):
    """The error codes for a signup form (a dict of strings), in field order; [] when it is valid."""
    username = _field(form, 'username')
    codes = [
        _username_error(username),
        _email_error(_field(form, 'email').lower()),
        *_password_errors(form.get('password'), form.get('confirm'), username),
        _age_error(_field(form, 'age')),
        _location_error(_field(form, 'country').upper(), _field(form, 'postcode').upper()),
        _referral_error(_field(form, 'referral')),
    ]
    return [code for code in codes if code]


def _field(form, name):
    """A field's text without surrounding whitespace; '' when it is missing."""
    return (form.get(name) or '').strip()


def _username_error(username):
    if not username:
        return 'username.required'
    if not 3 <= len(username) <= 20:
        return 'username.length'
    if not re.fullmatch(r'[a-z0-9_]+', username):
        return 'username.chars'
    if not USERNAME.fullmatch(username):
        return 'username.start'
    return 'username.reserved' if username in RESERVED else None


def _email_error(email):
    if not email:
        return 'email.required'
    local, _, domain = email.partition('@')
    if email.count('@') != 1 or not local or ' ' in email or not _domain_ok(domain):
        return 'email.format'
    return 'email.disposable' if domain in DISPOSABLE else None


def _domain_ok(domain):
    return '.' in domain and not domain.startswith('.') and not domain.endswith('.')


def _password_errors(password, confirm, username):
    """Unlike the other fields the password is not trimmed: spaces count."""
    if not password:
        return ['password.required']
    return [_password_strength_error(password, username), None if confirm == password else 'confirm.mismatch']


def _password_strength_error(password, username):
    if len(password) < 10:
        return 'password.length'
    if not any(ch.isalpha() for ch in password) or not any(ch in DIGITS for ch in password):
        return 'password.weak'
    if username and username.lower() in password.lower():
        return 'password.username'
    return None


def _age_error(age):
    if not age:
        return 'age.required'
    if any(ch not in DIGITS for ch in age):
        return 'age.invalid'
    if int(age) < 13:
        return 'age.minimum'
    return 'age.range' if int(age) > 120 else None


def _location_error(country, postcode):
    """The country, then its postcode once the country is supported."""
    if not country:
        return 'country.required'
    if country not in POSTCODES:
        return 'country.unsupported'
    if not postcode:
        return 'postcode.required'
    if country == 'CA':
        postcode = postcode.replace(' ', '')
    return None if POSTCODES[country].fullmatch(postcode) else 'postcode.format'


def _referral_error(referral):
    return 'referral.format' if referral and not REFERRAL.fullmatch(referral) else None
