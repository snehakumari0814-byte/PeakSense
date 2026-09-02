from datetime import datetime, timedelta
import requests


BASE_URL = "https://mahasldc.in/assets/shared/reports"


def build_url(date):
    filename = f"WEBSITE{date.strftime('%d%b%Y')}.pdf"
    return f"{BASE_URL}/{filename}"


test_dates = [
    datetime(2026, 8, 30),
    datetime(2026, 8, 29),
    datetime(2026, 8, 28),
    datetime(2026, 8, 27),
    datetime(2026, 8, 26),
]


print("Testing MSLDC report URLs")
print("-" * 60)

for date in test_dates:
    url = build_url(date)

    try:
        response = requests.head(
            url,
            timeout=20,
            allow_redirects=True
        )

        print(
            f"{date.strftime('%Y-%m-%d')} "
            f"| HTTP {response.status_code} "
            f"| {url}"
        )

    except requests.RequestException as error:
        print(
            f"{date.strftime('%Y-%m-%d')} "
            f"| ERROR: {error}"
        )