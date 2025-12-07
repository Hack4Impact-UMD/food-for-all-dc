import pandas as pd

# Path to your Excel file
excel_path = "ETL/FFA_CLIENT_DATABASE.xlsx"

# Load the Excel file
excel_file = pd.ExcelFile(excel_path)

# List all sheet names
print("Sheet names:")
for sheet in excel_file.sheet_names:
    print(f"- {sheet}")

# Print column headers for each sheet
def print_headers():
    for sheet in excel_file.sheet_names:
        df = pd.read_excel(excel_file, sheet_name=sheet, nrows=0)
        print(f"\nSheet: {sheet}")
        print("Columns:", list(df.columns))

if __name__ == "__main__":
    print_headers()
