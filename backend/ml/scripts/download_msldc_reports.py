from pathlib import Path
from datetime import date, timedelta
import requests
import time


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[2]

REPORTS_DIR = (
    BASE_DIR
    / "data"
    / "raw"
    / "electricity"
    / "reports"
)

REPORTS_DIR.mkdir(
    parents=True,
    exist_ok=True
)


# ------------------------------------------------------------
# CHANGE THESE DATES IF NEEDED
#
# Start with the previous 60 days.
# ------------------------------------------------------------

START_DATE = date(2026, 7, 1)
END_DATE = date(2026, 8, 30)


BASE_URL = (
    "https://mahasldc.in/assets/shared/reports/"
)


# ============================================================
# DOWNLOAD FUNCTION
# ============================================================

def build_filename(report_date):
    """
    Example:

    WEBSITE30Aug2026.pdf
    """

    return (
        f"WEBSITE"
        f"{report_date.strftime('%d%b%Y')}"
        f".pdf"
    )


def download_report(report_date):

    filename = build_filename(
        report_date
    )

    output_path = (
        REPORTS_DIR / filename
    )

    url = BASE_URL + filename

    # Don't download again if already present.
    if output_path.exists():

        print(
            f"SKIP (already exists): "
            f"{filename}"
        )

        return "exists"

    try:

        response = requests.get(
            url,
            timeout=30
        )

        if response.status_code == 200:

            # Basic check to avoid saving HTML error pages.
            content_type = response.headers.get(
                "Content-Type",
                ""
            )

            if (
                "pdf" not in content_type.lower()
                and not response.content.startswith(
                    b"%PDF"
                )
            ):

                print(
                    f"NOT PDF: {filename}"
                )

                return "not_pdf"

            output_path.write_bytes(
                response.content
            )

            print(
                f"DOWNLOADED: {filename}"
            )

            return "downloaded"

        else:

            print(
                f"NOT FOUND ({response.status_code}): "
                f"{filename}"
            )

            return "not_found"

    except requests.RequestException as error:

        print(
            f"ERROR: {filename} -> {error}"
        )

        return "error"


# ============================================================
# MAIN
# ============================================================

print("PeakSense MSLDC Historical Report Downloader")
print("=" * 70)

print(f"Start date: {START_DATE}")
print(f"End date:   {END_DATE}")
print(f"Save folder: {REPORTS_DIR}")

print("=" * 70)


current_date = START_DATE

downloaded = 0
existing = 0
not_found = 0
errors = 0


while current_date <= END_DATE:

    result = download_report(
        current_date
    )

    if result == "downloaded":
        downloaded += 1

    elif result == "exists":
        existing += 1

    elif result == "not_found":
        not_found += 1

    elif result in ["error", "not_pdf"]:
        errors += 1

    # Small delay so we don't hammer the server.
    time.sleep(0.3)

    current_date += timedelta(
        days=1
    )


print("\n" + "=" * 70)
print("DOWNLOAD COMPLETE")
print("=" * 70)

print(f"Downloaded: {downloaded}")
print(f"Already existed: {existing}")
print(f"Not found: {not_found}")
print(f"Errors: {errors}")

print(
    f"\nReports folder:\n{REPORTS_DIR}"
)