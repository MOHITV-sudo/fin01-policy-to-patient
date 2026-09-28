import os
from typing import List, Dict, Optional, Tuple
import pandas as pd

class CostDataManager:
    def __init__(self, csv_path: Optional[str] = None):
        if csv_path is None:
            base_dir = os.path.dirname(os.path.abspath(__file__))
            csv_path = os.path.join(base_dir, "data", "treatment_costs.csv")
        self.csv_path = csv_path
        self.df = pd.read_csv(self.csv_path)
        self.df["treatment_norm"] = self.df["treatment"].str.strip().str.lower()
        self.df["city_norm"] = self.df["city"].str.strip().str.lower()

    def get_treatments(self) -> List[str]:
        return sorted(self.df["treatment"].unique().tolist())

    def get_cities(self) -> List[str]:
        return sorted(self.df["city"].unique().tolist())

    def get_cost(self, treatment: str, city: Optional[str] = None) -> Optional[Dict[str, any]]:
        t_clean = treatment.strip().lower()
        
        # Exact or substring match for treatment
        t_matches = self.df[self.df["treatment_norm"] == t_clean]
        if t_matches.empty:
            t_matches = self.df[self.df["treatment_norm"].str.contains(t_clean, regex=False)]
        if t_matches.empty:
            # Reverse contains: check if any dataset treatment is in query
            t_matches = self.df[self.df["treatment_norm"].apply(lambda x: x in t_clean)]

        if t_matches.empty:
            return None

        matched_treatment_name = t_matches.iloc[0]["treatment"]

        if city:
            c_clean = city.strip().lower()
            city_matches = t_matches[t_matches["city_norm"] == c_clean]
            if not city_matches.empty:
                row = city_matches.iloc[0]
                return {
                    "treatment": matched_treatment_name,
                    "city": row["city"],
                    "min_cost": float(row["min_cost"]),
                    "avg_cost": float(row["avg_cost"]),
                    "max_cost": float(row["max_cost"]),
                    "is_national_average": False,
                    "source": "SYNTHETIC_DATASET"
                }

        # Fallback to national average
        return {
            "treatment": matched_treatment_name,
            "city": city or "National Average",
            "min_cost": float(t_matches["min_cost"].min()),
            "avg_cost": float(round(t_matches["avg_cost"].mean(), 2)),
            "max_cost": float(t_matches["max_cost"].max()),
            "is_national_average": True,
            "source": "SYNTHETIC_DATASET"
        }
