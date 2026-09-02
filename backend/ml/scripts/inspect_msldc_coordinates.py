from pathlib import Path
import pdfplumber


BASE_DIR = Path(__file__).resolve().parents[2]

PDF_PATH = (
    BASE_DIR
    / "data"
    / "raw"
    / "electricity"
    / "reports"
    / "WEBSITE30Aug2026.pdf"
)


print("Inspecting PDF with pdfplumber")
print("=" * 80)
print(PDF_PATH)
print("=" * 80)


with pdfplumber.open(PDF_PATH) as pdf:

    print(f"Total pages: {len(pdf.pages)}")

    for page_number, page in enumerate(pdf.pages, start=1):

        words = page.extract_words()

        # Search for words containing Mumbai
        mumbai_words = [
            word
            for word in words
            if "MUMBAI" in word["text"].upper()
        ]

        if mumbai_words:

            print("\n" + "#" * 80)
            print(f"FOUND MUMBAI ON PAGE {page_number}")
            print("#" * 80)

            for word in mumbai_words:

                print(word)

            print("\nNearby words:")

            for target in mumbai_words:

                target_top = target["top"]

                nearby = [
                    word
                    for word in words
                    if abs(word["top"] - target_top) < 15
                ]

                nearby = sorted(
                    nearby,
                    key=lambda word: word["x0"]
                )

                print("\nROW APPROXIMATION:")
                print(
                    " | ".join(
                        word["text"]
                        for word in nearby
                    )
                )