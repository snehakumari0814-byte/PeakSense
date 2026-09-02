from pathlib import Path
from pypdf import PdfReader


BASE_DIR = Path(__file__).resolve().parents[2]

PDF_PATH = (
    BASE_DIR
    / "data"
    / "raw"
    / "electricity"
    / "reports"
    / "WEBSITE30Aug2026.pdf"
)


print("Inspecting:")
print(PDF_PATH)
print("=" * 100)


reader = PdfReader(PDF_PATH)


for page_number, page in enumerate(reader.pages, start=1):

    print(f"\nPROCESSING PAGE {page_number}")
    print("=" * 100)

    try:
        text = page.extract_text(
            extraction_mode="layout"
        )
    except TypeError:
        print(
            "Your pypdf version does not support "
            "layout extraction."
        )
        text = page.extract_text()

    lines = text.splitlines()

    found = False

    for index, line in enumerate(lines):

        if "MUMBAI DEMAND" in line.upper():

            found = True

            print("\n")
            print("#" * 100)
            print("MUMBAI DEMAND SECTION")
            print("#" * 100)

            start = max(0, index - 15)
            end = min(len(lines), index + 40)

            for i in range(start, end):

                marker = ">>> " if i == index else "    "

                print(
                    f"{marker}{i:03d}: {lines[i]}"
                )

            print("#" * 100)

    if found:
        break