'''
This program reads two csv files and merges them based on a common key column.
'''
# import the pandas library
# you can install using the following command: pip install pandas

import pandas as pd

# Read the files into two dataframes.
df1 = pd.read_csv('Client Referral Form.csv')
df2 = pd.read_csv('FFA CLIENT DATABASE.csv')

# Clean first and last name columns and create final_name
df1['FIRST'] = df1['FIRST'].str.strip()
df1['LAST'] = df1['LAST'].str.strip()
df1['final_name'] = df1['FIRST'] + ' ' + df1['LAST']

df2['FIRST'] = df2['FIRST'].str.strip()
df2['LAST'] = df2['LAST'].str.strip()
df2['final_name'] = df2['FIRST'] + ' ' + df2['LAST']

print("Final names in df1:")
print(df1['final_name'].head())
print("Final names in df2:")
print(df2['final_name'].head())

# Display column information for debugging
print("Columns in Client Referral Form:", df1.columns.tolist())
print("Columns in FFA CLIENT DATABASE:", df2.columns.tolist())
print("Common columns:", set(df1.columns) & set(df2.columns))

# Merge the two dataframes with suffixes to handle duplicate columns
df3 = pd.merge(df1, df2, how='outer', on='final_name', suffixes=('_referral', '_database'))
print(df3.head())
# Remove duplicate final_name if it exists and set as index
if 'final_name' in df3.columns:
    df3.set_index('final_name', inplace=True)

# Sort by index for better organization
df3.sort_index(inplace=True)

print(f"\nMerged DataFrame shape: {df3.shape}")
print("\nFirst few rows:")
print(df3.head())

# Write it to a new CSV file
df3.to_csv('combined3.csv')
print(f"\nMerged data saved to 'combined3.csv'")
