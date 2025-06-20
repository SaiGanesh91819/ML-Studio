import pandas as pd #type:ignore
import seaborn as sns #type:ignore
import matplotlib.pyplot as plt
from sklearn.preprocessing import MinMaxScaler, StandardScaler, OneHotEncoder, LabelEncoder

def load_csv(path):
    try:
        df = pd.read_csv(path)
        print("File loaded successfully.\n")
        return df
    except Exception as e:
        print(f"Error loading file: {e}")
        return None

def handle_missing_values(df):
    print("\nMissing Value Handling Options:")
    print("1. Drop rows with missing values")
    print("2. Fill with mean")
    print("3. Fill with median")
    print("4. Fill with mode")
    choice = input("Enter your choice: ")

    if choice == '1':
        df = df.dropna()
    elif choice == '2':
        df = df.fillna(df.mean(numeric_only=True))
    elif choice == '3':
        df = df.fillna(df.median(numeric_only=True))
    elif choice == '4':
        for col in df.columns:
            df[col] = df[col].fillna(df[col].mode()[0])
    else:
        print("Invalid option.")
    return df

def remove_duplicates(df):
    print("\nDuplicate Handling Options:")
    print("1. Remove all duplicates")
    print("2. Remove duplicates based on specific columns")
    choice = input("Enter your choice: ")

    if choice == '1':
        df = df.drop_duplicates()
    elif choice == '2':
        cols = input("Enter column names separated by commas: ").split(',')
        df = df.drop_duplicates(subset=[col.strip() for col in cols])
    else:
        print("Invalid option.")
    return df

def fix_data_consistency(df):
    col = input("Enter column to standardize case: ")
    if col in df.columns:
        df[col] = df[col].astype(str).str.lower().str.strip()
    else:
        print("Column not found.")
    return df

def normalize_data(df):
    print("\nNormalization Options:")
    print("1. Min-Max Normalization")
    print("2. Z-score Standardization")
    choice = input("Enter your choice: ")

    cols = input("Enter numeric columns to normalize (comma-separated): ").split(',')
    cols = [c.strip() for c in cols if c.strip() in df.columns]

    if not cols:
        print("No valid columns provided.")
        return df

    if choice == '1':
        scaler = MinMaxScaler()
    elif choice == '2':
        scaler = StandardScaler()
    else:
        print("Invalid option.")
        return df

    df[cols] = scaler.fit_transform(df[cols])
    return df

def correlation_analysis(df):
    print("\nCorrelation Matrix:")
    corr = df.corr(numeric_only=True)
    print(corr)
    show_plot = input("Do you want to plot a heatmap? (yes/no): ")
    if show_plot.lower() == 'yes':
        sns.heatmap(corr, annot=True, cmap='coolwarm')
        plt.show()

def encode_categorical(df):
    print("\nEncoding Options:")
    print("1. Label Encoding")
    print("2. One-Hot Encoding")
    choice = input("Enter your choice: ")
    col = input("Enter the column to encode: ")

    if col not in df.columns:
        print("Column not found.")
        return df

    if choice == '1':
        encoder = LabelEncoder()
        df[col] = encoder.fit_transform(df[col].astype(str))
    elif choice == '2':
        df = pd.get_dummies(df, columns=[col])
    else:
        print("Invalid option.")
    return df

def main():
    path = input("Enter CSV file path: ")
    df = load_csv(path)
    if df is None:
        return

    while True:
        print("\nSelect Preprocessing Option:")
        print("1. Handle Missing Values")
        print("2. Remove Duplicates")
        print("3. Fix Data Consistency")
        print("4. Normalize Data")
        print("5. Correlation Analysis")
        print("6. Encode Categorical Data")
        print("7. Exit")
        option = input("Enter your choice: ")

        if option == '1':
            df = handle_missing_values(df)
        elif option == '2':
            df = remove_duplicates(df)
        elif option == '3':
            df = fix_data_consistency(df)
        elif option == '4':
            df = normalize_data(df)
        elif option == '5':
            correlation_analysis(df)
        elif option == '6':
            df = encode_categorical(df)
        elif option == '7':
            break
        else:
            print("Invalid option.")

    save = input("Do you want to save the processed file? (yes/no): ")
    if save.lower() == 'yes':
        out_path = input("Enter output file name: ")
        df.to_csv(out_path, index=False)
        print("File saved successfully.")

if __name__ == '__main__':
    main()
