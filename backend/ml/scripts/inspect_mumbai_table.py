from pathlib import Path

import pdfplumber


# ============================================================
# PATH CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[2]

PDF_PATH = (
    BASE_DIR
    / "data"
    / "raw"
    / "electricity"
    / "reports"
    / "WEBSITE30Aug2026.pdf"
)


# ============================================================
# INSPECTION RANGE
#
# We are inspecting the table header area above the
# Mumbai Demand row.
# ============================================================

TOP_MIN = 400
TOP_MAX = 520


# ============================================================
# MAIN
# ============================================================

print("=" * 100)
print("MUMBAI DEMAND TABLE HEADER INSPECTION")
print("=" * 100)
print(PDF_PATH)
print("=" * 100)


if not PDF_PATH.exists():

    print("\nERROR: PDF FILE NOT FOUND")
    print(PDF_PATH)

    raise SystemExit


with pdfplumber.open(PDF_PATH) as pdf:

    # --------------------------------------------------------
    # Use page 1.
    # --------------------------------------------------------

    page = pdf.pages[0]

    print("\nPAGE SIZE")

    print(f"Width: {page.width}")
    print(f"Height: {page.height}")


    # --------------------------------------------------------
    # Extract words.
    # --------------------------------------------------------

    words = page.extract_words(
        x_tolerance=2,
        y_tolerance=2
    )


    # --------------------------------------------------------
    # Filter words in the header inspection range.
    # --------------------------------------------------------

    print("\n" + "=" * 100)
    print(
        f"WORDS BETWEEN TOP={TOP_MIN} "
        f"AND TOP={TOP_MAX}"
    )
    print("=" * 100)


    filtered_words = [
        word
        for word in words
        if TOP_MIN <= word["top"] <= TOP_MAX
    ]


    # Sort first by vertical position,
    # then by horizontal position.
    filtered_words = sorted(
        filtered_words,
        key=lambda word: (
            round(word["top"], 1),
            word["x0"]
        )
    )


    # --------------------------------------------------------
    # Print every word with coordinates.
    # --------------------------------------------------------

    for word in filtered_words:

        print(
            f"text={word['text']:<20} "
            f"x0={word['x0']:>8.2f} "
            f"x1={word['x1']:>8.2f} "
            f"top={word['top']:>8.2f}"
        )


    # ========================================================
    # GROUP WORDS BY APPROXIMATE ROW
    # ========================================================

    print("\n" + "=" * 100)
    print("GROUPED BY ROW")
    print("=" * 100)


    rows = {}


    for word in filtered_words:

        # Group words that are approximately
        # on the same horizontal line.
        row_key = round(
            word["top"] / 5
        ) * 5


        rows.setdefault(
            row_key,
            []
        ).append(word)


    # --------------------------------------------------------
    # Print grouped rows.
    # --------------------------------------------------------

    for row_key in sorted(rows):

        row = sorted(
            rows[row_key],
            key=lambda word: word["x0"]
        )


        print("\n" + "-" * 100)
        print(f"ROW TOP: {row_key}")
        print("-" * 100)


        for word in row:

            print(
                f"{word['text']} "
                f"(x={word['x0']:.1f})",
                end=" | "
            )


        print()


    # ========================================================
    # SHOW WORDS NEAR THE FOUR MUMBAI DEMAND COLUMNS
    #
    # Mumbai demand values are approximately located at:
    #
    # Column 1 -> x ≈ 247
    # Column 2 -> x ≈ 342
    # Column 3 -> x ≈ 434
    # Column 4 -> x ≈ 525
    # ========================================================

    print("\n" + "=" * 100)
    print("WORDS NEAR THE FOUR MUMBAI DEMAND COLUMNS")
    print("=" * 100)


    target_columns = [
        ("COLUMN 1", 247),
        ("COLUMN 2", 342),
        ("COLUMN 3", 434),
        ("COLUMN 4", 525),
    ]


    X_TOLERANCE = 35


    for column_name, target_x in target_columns:

        print("\n" + "-" * 100)

        print(
            f"{column_name} "
            f"(TARGET X ≈ {target_x})"
        )

        print("-" * 100)


        column_words = [

            word

            for word in filtered_words

            if abs(word["x0"] - target_x)
            <= X_TOLERANCE

        ]


        column_words = sorted(
            column_words,
            key=lambda word: (
                word["top"],
                word["x0"]
            )
        )


        if not column_words:

            print("No words found.")

            continue


        for word in column_words:

            print(
                f"text={word['text']:<20} "
                f"x0={word['x0']:>8.2f} "
                f"top={word['top']:>8.2f}"
            )


print("\n" + "=" * 100)
print("DONE")
print("=" * 100)