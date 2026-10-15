from .limiter import FixedWindowLimiter, TokenBucket

# Requests per minute for each plan.
PLANS = {
    'free': 60,
    'pro': 600,
}


def limiter_for(plan, clock=None):
    """The limiter one API key on `plan` gets."""
    try:
        per_minute = PLANS[plan]
    except KeyError:
        raise ValueError('unknown plan: %s' % plan) from None
    if plan == 'pro':
        return TokenBucket(per_minute / 60, 50, clock)
    return FixedWindowLimiter(per_minute, 60, clock)
