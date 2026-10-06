import math
from decimal import Decimal, localcontext, ROUND_HALF_UP

EARTH = 6371.0
PI_D = Decimal("3.1415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679")

def decimal_round_km(lat1, lon1, lat2, lon2):
    # Slow path for values close to a rounding boundary or near the antipode.
    def sin(x):
        term = total = x
        i = 1
        while True:
            term *= -(x * x) / Decimal((2 * i) * (2 * i + 1))
            nxt = total + term
            if nxt == total: return total
            total = nxt; i += 1
    def cos(x):
        term = total = Decimal(1)
        i = 1
        while True:
            term *= -(x * x) / Decimal((2 * i - 1) * (2 * i))
            nxt = total + term
            if nxt == total: return total
            total = nxt; i += 1
    def atan(x):
        if x < 0: return -atan(-x)
        scale = 0
        while x > Decimal("0.05"):
            x = x / (Decimal(1) + (Decimal(1) + x*x).sqrt())
            scale += 1
        term = total = x
        i = 1
        while True:
            term *= -(x*x)
            nxt = total + term / Decimal(2*i + 1)
            if nxt == total: return total * (2 ** scale)
            total = nxt; i += 1
    def atan2(y, x):
        if x == 0: return PI_D / 2
        if y == 0: return Decimal(0)
        return atan(y/x) if x > 0 else PI_D - atan(y/(-x))
    with localcontext() as ctx:
        ctx.prec = 80
        p1, p2 = Decimal(str(lat1))*PI_D/180, Decimal(str(lat2))*PI_D/180
        dp = (Decimal(str(lat2))-Decimal(str(lat1)))*PI_D/180
        dl = (Decimal(str(lon2))-Decimal(str(lon1)))*PI_D/180
        a = sin(dp/2)**2 + cos(p1)*cos(p2)*sin(dl/2)**2
        a = min(Decimal(1), max(Decimal(0), a))
        km = Decimal(6371)*2*atan2(a.sqrt(), (1-a).sqrt())
        return int(km.to_integral_value(rounding=ROUND_HALF_UP))

def raw_haversine_km(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(float, (lat1, lon1, lat2, lon2))
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    a = min(1.0, max(0.0, a))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    km = EARTH * c
    return km

def half_up_km(lat1, lon1, lat2, lon2):
    km = raw_haversine_km(lat1, lon1, lat2, lon2)
    # Double precision can move a result across a half-kilometer boundary.
    # The 18-decimal input limit lets this conservative band trigger a
    # high-precision Decimal recomputation only for numerically sensitive cases.
    if abs(km - (math.floor(km) + 0.5)) < 1e-5 or km > 20015.0:
        return decimal_round_km(lat1, lon1, lat2, lon2)
    # The mathematical distance cannot be an exact half-integer for finite-
    # decimal coordinates; this is the unique nearest integer.
    return math.floor(km + 0.5)

def solve(raw):
    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    if not lines:
        return ""
    q = int(lines[0])
    datacenters = {}
    out = []
    for line in lines[1:q + 1]:
        p = line.split()
        op = p[0]
        if op == "REGISTER":
            name, lat_s, lon_s, cap_s = p[1:]
            lat, lon, cap = float(lat_s), float(lon_s), int(cap_s)
            if name in datacenters or not (-90 <= lat <= 90 and -180 <= lon <= 180) or cap <= 0:
                out.append("ERROR")
            else:
                # Preserve original decimals for the high-precision fallback.
                datacenters[name] = [lat_s, lon_s, cap, 0, True]
                out.append("OK")
        elif op == "SET_HEALTHY":
            name, value = p[1:]
            if name not in datacenters or value not in ("true", "false"):
                out.append("ERROR")
            else:
                datacenters[name][4] = value == "true"
                out.append("OK")
        elif op == "DISTANCE":
            lat1, lon1, lat2, lon2 = p[1:]
            f_lat1, f_lon1, f_lat2, f_lon2 = map(float, (lat1, lon1, lat2, lon2))
            if not (-90 <= f_lat1 <= 90 and -180 <= f_lon1 <= 180 and
                    -90 <= f_lat2 <= 90 and -180 <= f_lon2 <= 180):
                out.append("ERROR")
            else:
                out.append(str(half_up_km(lat1, lon1, lat2, lon2)))
        elif op == "ROUTE":
            lat, lon = p[1:]
            candidates = []
            for name, (dlat, dlon, cap, load, healthy) in datacenters.items():
                if healthy:
                    candidates.append((half_up_km(lat, lon, dlat, dlon), name))
            candidates.sort()
            names = ",".join(name for _, name in candidates)
            selected = None
            for distance, name in candidates:
                if datacenters[name][3] < datacenters[name][2]:
                    datacenters[name][3] += 1
                    selected = (distance, name)
                    break
            if selected is None:
                out.append(f"None {names}" if names else "None")
            else:
                distance, name = selected
                out.append(f"{name} {distance} {names}")
    return "\n".join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
