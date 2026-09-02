from pathlib import Path
from datetime import datetime
import re

import pandas as pd
import pdfplumber


# ============================================================
# PATH CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[2]

REPORTS_DIR = (
    BASE_DIR
    / "data"
    / "raw"
    / "electricity"
    / "reports"
)

OUTPUT_FILE = (
    BASE_DIR
    / "data"
    / "raw"
    / "electricity"
    / "mumbai_demand_extracted.csv"
)


# ============================================================
# PDF TABLE CONFIGURATION
# ============================================================

# The Mumbai Demand table is located near the bottom
# of page 1 in the current MSLDC report format.

MUMBAI_ROW_MIN_TOP = 650
MUMBAI_ROW_MAX_TOP = 730

# X positions of the four numeric demand columns.
# These were verified using inspect_mumbai_table.py.

COLUMN_X_POSITIONS = [
    247,
    342,
    434,
    525,
]

COLUMN_NAMES = [
    "morning_peak_10h",
    "day_peak_16h",
    "evening_peak_20h",
    "night_minimum_3h",
]


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def get_report_date(filename):
    """
    Extract date from filenames like:

    WEBSITE30Aug2026.pdf

    Returns:
        datetime object or None
    """

    match = re.search(
        r"WEBSITE(\d{1,2}[A-Za-z]{3}\d{4})\.pdf",
        filename,
        re.IGNORECASE
    )

    if not match:
        return None

    try:

        return datetime.strptime(
            match.group(1),
            "%d%b%Y"
        )

    except ValueError:

        return None


def is_number(text):
    """
    Check whether text can be converted to a number.
    """

    cleaned = (
        text
        .replace(",", "")
        .strip()
    )

    try:

        float(cleaned)
        return True

    except ValueError:

        return False


def find_mumbai_demand_row(words):
    """
    Find the MUMBAI DEMAND row in the peak demand table.

    Returns:
        (target_top, row_words)

    or:

        (None, None)
    """

    candidates = []

    for word in words:

        if (
            word["text"].upper() == "MUMBAI"
            and MUMBAI_ROW_MIN_TOP
            <= word["top"]
            <= MUMBAI_ROW_MAX_TOP
        ):

            candidates.append(word)

    if not candidates:

        return None, None

    # Check each MUMBAI occurrence and ensure
    # DEMAND exists on the same row.

    for candidate in candidates:

        target_top = candidate["top"]

        row_words = [
            word
            for word in words
            if abs(word["top"] - target_top) < 5
        ]

        row_words = sorted(
            row_words,
            key=lambda word: word["x0"]
        )

        row_texts = [
            word["text"].upper()
            for word in row_words
        ]

        if "DEMAND" in row_texts:

            return target_top, row_words

    return None, None


def get_column_index(x0):
    """
    Find which of the four Mumbai demand columns
    a numeric value belongs to.

    Returns:
        0, 1, 2, 3

    or None if the value does not belong to one
    of the expected columns.
    """

    distances = [
        abs(x0 - target_x)
        for target_x in COLUMN_X_POSITIONS
    ]

    closest_index = distances.index(
        min(distances)
    )

    closest_distance = distances[
        closest_index
    ]

    # Numeric values are usually within about
    # 10 pixels of the expected column location.

    if closest_distance > 20:

        return None

    return closest_index


def extract_mumbai_values(pdf_path):
    """
    Extract the four Mumbai Demand values from page 1.

    Expected row structure:

    MUMBAI | DEMAND | value1 | value2 | value3 | value4

    The columns are:

    value1 -> Morning Peak at 10 Hrs
    value2 -> Day Peak at 16 Hrs
    value3 -> Evening Peak at 20 Hrs
    value4 -> Night Minimum at 3 Hrs

    Returns:
        dictionary

    Example:

        {
            "morning_peak_10h": 2841.0,
            "day_peak_16h": 3013.0,
            "evening_peak_20h": 3034.0,
            "night_minimum_3h": 2574.0
        }

    or None if extraction fails.
    """

    with pdfplumber.open(pdf_path) as pdf:

        if not pdf.pages:

            print(
                "WARNING: PDF contains no pages."
            )

            return None

        page = pdf.pages[0]

        words = page.extract_words(
            x_tolerance=2,
            y_tolerance=2
        )

        if not words:

            print(
                "WARNING: No text could be extracted "
                "from page 1."
            )

            return None

        # ----------------------------------------------------
        # Find MUMBAI DEMAND row.
        # ----------------------------------------------------

        target_top, row_words = (
            find_mumbai_demand_row(words)
        )

        if row_words is None:

            print(
                "WARNING: Could not find "
                "MUMBAI DEMAND row."
            )

            return None

        print("\nMumbai Demand row found:")
        print(
            f"Row top position: {target_top:.2f}"
        )

        print(
            " | ".join(
                word["text"]
                for word in row_words
            )
        )

        # ----------------------------------------------------
        # Extract numeric values by column position.
        # ----------------------------------------------------

        values_by_column = {}

        for word in row_words:

            text = word["text"]

            if not is_number(text):

                continue

            column_index = get_column_index(
                word["x0"]
            )

            if column_index is None:

                print(
                    f"Ignoring numeric value "
                    f"{text} at x={word['x0']:.2f}"
                )

                continue

            value = float(
                text.replace(",", "")
            )

            values_by_column[
                column_index
            ] = value

            print(
                f"Column {column_index + 1}: "
                f"{value} MW "
                f"(x={word['x0']:.2f})"
            )

        # ----------------------------------------------------
        # Validate all four columns.
        # ----------------------------------------------------

        if len(values_by_column) != 4:

            print(
                "\nWARNING: Expected values in all "
                f"4 columns but found "
                f"{len(values_by_column)}."
            )

            return None

        # ----------------------------------------------------
        # Build named result.
        # ----------------------------------------------------

        result = {}

        for index, column_name in enumerate(
            COLUMN_NAMES
        ):

            if index not in values_by_column:

                print(
                    f"WARNING: Missing column "
                    f"{index + 1}."
                )

                return None

            value = values_by_column[index]

            # Demand must be positive.

            if value <= 0:

                print(
                    f"WARNING: Invalid demand value "
                    f"{value} in {column_name}."
                )

                return None

            result[column_name] = value

        print("\nExtracted Mumbai Demand values:")

        for column_name, value in result.items():

            print(
                f"{column_name}: {value} MW"
            )

        return result


# ============================================================
# MAIN EXTRACTION
# ============================================================

print("PeakSense Mumbai Demand Extractor")
print("=" * 70)

pdf_files = sorted(
    REPORTS_DIR.glob("*.pdf"),
    key=lambda path: (
        get_report_date(path.name)
        or datetime.min
    )
)

print(
    f"PDF reports found: "
    f"{len(pdf_files)}"
)

print(
    f"Reports directory: "
    f"{REPORTS_DIR}"
)


if not pdf_files:

    print("\nNO PDF FILES FOUND.")

    print(
        "Make sure the reports are inside:\n"
        f"{REPORTS_DIR}"
    )

    raise SystemExit


records = []
failed_files = []


for pdf_path in pdf_files:

    print("\n" + "-" * 70)

    print(
        f"Processing: "
        f"{pdf_path.name}"
    )

    # --------------------------------------------------------
    # Extract report date.
    # --------------------------------------------------------

    report_date = get_report_date(
        pdf_path.name
    )

    if report_date is None:

        print(
            "FAILED: Could not extract "
            "date from filename."
        )

        failed_files.append(
            pdf_path.name
        )

        continue


    try:

        # ----------------------------------------------------
        # Extract Mumbai demand values.
        # ----------------------------------------------------

        values = extract_mumbai_values(
            pdf_path
        )

        if values is None:

            print(
                "FAILED: Could not extract "
                "Mumbai demand values."
            )

            failed_files.append(
                pdf_path.name
            )

            continue


        # ----------------------------------------------------
        # IMPORTANT COLUMN MAPPING
        #
        # PDF column order:
        #
        # 1 -> Morning Peak at 10 Hrs
        # 2 -> Day Peak at 16 Hrs
        # 3 -> Evening Peak at 20 Hrs
        # 4 -> Night Minimum at 3 Hrs
        # ----------------------------------------------------

        observations = [

            (
                "10:00:00",
                values["morning_peak_10h"],
                "morning_peak"
            ),

            (
                "16:00:00",
                values["day_peak_16h"],
                "day_peak"
            ),

            (
                "20:00:00",
                values["evening_peak_20h"],
                "evening_peak"
            ),

            (
                "03:00:00",
                values["night_minimum_3h"],
                "night_minimum"
            ),

        ]


        # ----------------------------------------------------
        # Create output records.
        # ----------------------------------------------------

        for (
            time_value,
            demand_mw,
            observation_type
        ) in observations:

            timestamp = pd.Timestamp(
                f"{report_date.date()} "
                f"{time_value}"
            ).tz_localize(
                "Asia/Kolkata"
            )

            records.append(
                {
                    "timestamp": timestamp.isoformat(),
                    "demand_mw": demand_mw,
                    "observation_type": (
                        observation_type
                    ),
                    "source": (
                        "MSLDC Daily System "
                        "Operations Report"
                    ),
                    "report_file": (
                        pdf_path.name
                    ),
                }
            )


        # ----------------------------------------------------
        # Print success.
        # ----------------------------------------------------

        print("\nSUCCESS")

        print(
            "Morning Peak (10:00) -> "
            f"{values['morning_peak_10h']} MW"
        )

        print(
            "Day Peak (16:00) -> "
            f"{values['day_peak_16h']} MW"
        )

        print(
            "Evening Peak (20:00) -> "
            f"{values['evening_peak_20h']} MW"
        )

        print(
            "Night Minimum (03:00) -> "
            f"{values['night_minimum_3h']} MW"
        )


    except Exception as error:

        print(
            f"ERROR while processing "
            f"{pdf_path.name}: {error}"
        )

        failed_files.append(
            pdf_path.name
        )


# ============================================================
# SAVE RESULTS
# ============================================================

if records:

    df = pd.DataFrame(records)

    # --------------------------------------------------------
    # Convert timestamps for chronological sorting.
    # --------------------------------------------------------

    df["timestamp"] = pd.to_datetime(
        df["timestamp"]
    )

    df = df.sort_values(
        "timestamp"
    ).reset_index(
        drop=True
    )

    # --------------------------------------------------------
    # Convert timestamps back to ISO 8601.
    # --------------------------------------------------------

    df["timestamp"] = df[
        "timestamp"
    ].apply(
        lambda value: value.isoformat()
    )

    # --------------------------------------------------------
    # Ensure output directory exists.
    # --------------------------------------------------------

    OUTPUT_FILE.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    # --------------------------------------------------------
    # Save CSV.
    # --------------------------------------------------------

    df.to_csv(
        OUTPUT_FILE,
        index=False
    )


    print("\n" + "=" * 70)
    print("EXTRACTION COMPLETE")
    print("=" * 70)

    print(
        f"Records extracted: "
        f"{len(df)}"
    )

    print(
        f"Successful reports: "
        f"{len(pdf_files) - len(failed_files)}"
    )

    print(
        f"Failed reports: "
        f"{len(failed_files)}"
    )

    print(
        f"\nSaved to:\n"
        f"{OUTPUT_FILE}"
    )


    print("\nDATA PREVIEW")

    print(
        df.head(12).to_string(
            index=False
        )
    )


else:

    print("\n" + "=" * 70)
    print("NO DATA WAS EXTRACTED.")
    print("=" * 70)


# ============================================================
# FAILED FILES
# ============================================================

if failed_files:

    print("\nFAILED FILES:")

    for filename in failed_files:

        print(
            f"- {filename}"
        )

else:

    print(
        "\nAll PDF reports were processed successfully."
    )