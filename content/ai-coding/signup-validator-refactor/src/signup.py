"""Signup form checks for the account service.

The web and mobile clients show a message per error code and the growth dashboards count them,
so the codes, and their order, must not change.
"""

RESERVED = ['admin', 'root', 'support', 'help', 'system']
DISPOSABLE = ['mailinator.com', 'tempmail.dev', 'throwaway.email']
COUNTRIES = ['US', 'CA', 'GB', 'DE', 'CN']


def validate_signup(form):
    """The error codes for a signup form (a dict of strings), in field order; [] when it is valid."""
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
