#!/usr/bin/env python3
"""
generate_data.py
Generates synthetic patient records for the missing-patients primary care panel.

Schema matches the Supabase 'patients' table:
  patient_identifier, first_name, last_name, age, days_overdue,
  urgency_label, urgency_score, preferred_language, outreach_status,
  home_phone, email_address, last_well_visit

Existing ID prefixes in production: NN, KZ, WL, PT
Batch 1 (250 patients) used those prefixes.
Batch 2 (1550 patients) uses prefix SV (SV-0001 … SV-1550).
"""

import csv
import random
from datetime import date, timedelta

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

random.seed(42)

TODAY = date(2026, 4, 22)
NUM_PATIENTS = 1550
ID_PREFIX = "SV"
OUTPUT_FILE = "datasets/new_patients_batch2.csv"

COLUMNS = [
    "patient_identifier",
    "first_name",
    "last_name",
    "age",
    "days_overdue",
    "urgency_label",
    "urgency_score",
    "preferred_language",
    "outreach_status",
    "home_phone",
    "email_address",
    "last_well_visit",
]

# ---------------------------------------------------------------------------
# Distributions
# ---------------------------------------------------------------------------

URGENCY_WEIGHTS = [
    ("Critical",  8),
    ("High",     22),
    ("Medium",   35),
    ("Low",      25),
    ("On Track", 10),
]

LANGUAGE_WEIGHTS = [
    ("English",        55),
    ("Spanish",        20),
    ("Mandarin",        8),
    ("Arabic",          6),
    ("French",          4),
    ("Haitian Creole",  3),
    ("Portuguese",      2),
    ("Other",           2),
]

# Age buckets: under 18, 18-65, 65+  →  20% / 40% / 40%
AGE_BUCKETS = [
    (2,  17, 20),
    (18, 64, 40),
    (65, 92, 40),
]

# ---------------------------------------------------------------------------
# Name pools (first / last) by language group
# ---------------------------------------------------------------------------

NAMES = {
    "English": {
        "first_m": ["James","John","Robert","Michael","David","William","Richard","Joseph","Thomas","Charles",
                    "Christopher","Daniel","Matthew","Anthony","Mark","Donald","Steven","Paul","Andrew","Joshua",
                    "Kevin","Brian","George","Timothy","Ronald","Edward","Jason","Jeffrey","Ryan","Gary",
                    "Jacob","Nicholas","Eric","Stephen","Jonathan","Larry","Justin","Scott","Brandon","Benjamin",
                    "Samuel","Raymond","Patrick","Frank","Alexander","Jack","Dennis","Jerry","Tyler","Aaron"],
        "first_f": ["Mary","Patricia","Jennifer","Linda","Barbara","Elizabeth","Susan","Jessica","Sarah","Karen",
                    "Nancy","Lisa","Margaret","Betty","Sandra","Ashley","Dorothy","Kimberly","Emily","Donna",
                    "Michelle","Carol","Amanda","Melissa","Deborah","Stephanie","Rebecca","Sharon","Laura","Cynthia",
                    "Kathleen","Amy","Angela","Shirley","Anna","Brenda","Pamela","Emma","Nicole","Helen",
                    "Samantha","Katherine","Christine","Debra","Rachel","Carolyn","Janet","Catherine","Maria","Heather"],
        "last":    ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Wilson","Anderson",
                    "Taylor","Thomas","Jackson","White","Harris","Martin","Thompson","Young","Allen","King",
                    "Wright","Scott","Green","Baker","Adams","Nelson","Carter","Mitchell","Perez","Roberts",
                    "Turner","Phillips","Campbell","Parker","Evans","Edwards","Collins","Stewart","Morris","Rogers",
                    "Reed","Cook","Bailey","Bell","Cooper","Richardson","Cox","Howard","Ward","Torres"],
    },
    "Spanish": {
        "first_m": ["José","Carlos","Juan","Luis","Miguel","Alejandro","Andrés","Fernando","Diego","Ricardo",
                    "Raúl","Eduardo","Antonio","Gabriel","Sergio","Roberto","Pablo","Héctor","Javier","Ernesto",
                    "Marcos","Rodrigo","Arturo","Enrique","Víctor","Adrián","Manuel","Rafael","Francisco","Gerardo"],
        "first_f": ["María","Ana","Sofía","Isabella","Valentina","Camila","Lucía","Daniela","Gabriela","Patricia",
                    "Rosa","Carmen","Guadalupe","Elena","Fernanda","Alejandra","Verónica","Claudia","Adriana","Sandra",
                    "Mónica","Laura","Diana","Yesenia","Marisol","Leticia","Gloria","Graciela","Beatriz","Esperanza"],
        "last":    ["García","Martínez","López","González","Hernández","Pérez","Rodríguez","Sánchez","Ramírez","Torres",
                    "Flores","Rivera","Gómez","Díaz","Cruz","Morales","Reyes","Gutiérrez","Ortega","Jiménez",
                    "Mendoza","Álvarez","Castillo","Moreno","Romero","Navarro","Herrera","Medina","Vargas","Delgado"],
    },
    "Mandarin": {
        "first_m": ["Wei","Fang","Yang","Hao","Jian","Ming","Lei","Tao","Jun","Peng",
                    "Xiao","Bo","Zheng","Qiang","Feng","Gang","Bin","Chao","Dong","Hui"],
        "first_f": ["Li","Yan","Xia","Ying","Hong","Mei","Jing","Fang","Lin","Na",
                    "Yun","Qian","Xin","Lan","Zhen","Dan","Hua","Ping","Jie","Juan"],
        "last":    ["Wang","Li","Zhang","Liu","Chen","Yang","Huang","Zhao","Wu","Zhou",
                    "Xu","Sun","Ma","Zhu","Hu","Guo","He","Lin","Luo","Liang",
                    "Song","Deng","Han","Tang","Cao","Feng","Dong","Xiao","Cai","Jiang"],
    },
    "Arabic": {
        "first_m": ["Mohammed","Omar","Ahmed","Ali","Hassan","Ibrahim","Yusuf","Khalid","Tariq","Samir",
                    "Nabil","Faisal","Kareem","Rami","Adil","Ziad","Bilal","Mustafa","Hisham","Waleed"],
        "first_f": ["Fatima","Aisha","Maryam","Nour","Sara","Layla","Yasmin","Hana","Amira","Rima",
                    "Salma","Dina","Rana","Nadia","Lina","Huda","Ghada","Manal","Wafa","Abeer"],
        "last":    ["Al-Hassan","Al-Rahman","Al-Farsi","Al-Rashid","Al-Mahmoud","Khalil","Nasser","Hamdan","Othman","Jaber",
                    "Mansour","Salem","Qasem","Shehab","Bishara","Haddad","Khoury","Nassar","Abboud","Rizk"],
    },
    "French": {
        "first_m": ["Jean","Pierre","Michel","François","Philippe","Laurent","Nicolas","Julien","Alexandre","Antoine",
                    "Christophe","Thomas","Sébastien","Benoît","Vincent","Frédéric","Olivier","Éric","Guillaume","Patrick"],
        "first_f": ["Marie","Sophie","Claire","Julie","Nathalie","Isabelle","Céline","Sylvie","Camille","Hélène",
                    "Anne","Christine","Valérie","Sandrine","Véronique","Aurélie","Stéphanie","Pauline","Émilie","Laure"],
        "last":    ["Martin","Bernard","Dubois","Thomas","Robert","Richard","Petit","Durand","Leroy","Moreau",
                    "Simon","Laurent","Lefebvre","Michel","Garcia","David","Bertrand","Roux","Vincent","Fournier"],
    },
    "Haitian Creole": {
        "first_m": ["Jean","Pierre","Marc","Louis","Henry","Frantz","Jude","Robenson","Wilfrid","Dieudonne",
                    "Edner","Gesner","Ludovic","Renald","Gaston","Willy","Reginald","Magloire","Guerlain","Clercide"],
        "first_f": ["Marie","Rose","Louisiane","Claudette","Yolande","Marlène","Guerda","Nadège","Carole","Fabiola",
                    "Jocelyne","Mirlande","Ketsia","Bernadette","Céleste","Yanick","Faidherbe","Magalie","Lucienne","Eveline"],
        "last":    ["Jean","Pierre","Joseph","Baptiste","Louis","François","Paul","Charles","Michel","Duval",
                    "Desrosiers","Lafortune","Dorcelus","Estimé","Brutus","Cadet","Célestin","Prophète","Maxime","Augustin"],
    },
    "Portuguese": {
        "first_m": ["João","Pedro","Carlos","Luís","Ricardo","Fernando","Alexandre","Bruno","Rodrigo","Tiago",
                    "Vitor","Hugo","Nuno","Gonçalo","António","Paulo","Rui","Sérgio","Marco","David"],
        "first_f": ["Ana","Maria","Inês","Sofia","Catarina","Beatriz","Mariana","Filipa","Carla","Sara",
                    "Patrícia","Susana","Joana","Rita","Marta","Paula","Sónia","Cristina","Isabel","Teresa"],
        "last":    ["Silva","Santos","Ferreira","Pereira","Oliveira","Costa","Rodrigues","Martins","Jesus","Sousa",
                    "Fernandes","Gonçalves","Gomes","Lopes","Marques","Alves","Almeida","Ribeiro","Pinto","Carvalho"],
    },
    "Other": {
        "first_m": ["Nguyen","Dmitri","Oluwaseun","Kwame","Arjun","Viktor","Yohannes","Kenji","Soren","Mikael",
                    "Amadou","Tariku","Bao","Dragos","Bogdan","Tenzin","Hamid","Aarav","Sung","Riku"],
        "first_f": ["Nguyen","Svetlana","Adaeze","Akosua","Priya","Olga","Tigist","Yuki","Astrid","Ingrid",
                    "Aminata","Hirut","Linh","Ioana","Elena","Tenzin","Fatou","Ananya","Ji-Yeon","Aiko"],
        "last":    ["Nguyen","Ivanov","Okafor","Asante","Sharma","Petrov","Tadesse","Tanaka","Nielsen","Eriksson",
                    "Diallo","Haile","Tran","Popescu","Moldovan","Dorje","Ba","Patel","Kim","Watanabe"],
    },
}

# Area codes by US region (realistic distribution)
AREA_CODES = [
    "617","781","857","339",  # Boston MA
    "212","718","917","646",  # NYC
    "323","213","310","818",  # LA
    "312","773","708","847",  # Chicago
    "713","832","281","346",  # Houston
    "215","267","484","610",  # Philadelphia
    "602","480","623","520",  # Phoenix
    "210","512","737","830",  # San Antonio / Austin
    "619","858","760","442",  # San Diego
    "214","469","972","817",  # Dallas
]

EMAIL_DOMAINS = [
    "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "aol.com",
    "icloud.com", "comcast.net", "att.net", "verizon.net", "msn.com",
]

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def weighted_choice(pairs):
    """Choose a value from [(value, weight), ...] list."""
    population = [v for v, w in pairs for _ in range(w)]
    return random.choice(population)


def random_age():
    age_pairs = [(lo, w) for lo, _hi, w in AGE_BUCKETS]
    chosen_lo = weighted_choice(age_pairs)
    bucket = next(b for b in AGE_BUCKETS if b[0] == chosen_lo)
    lo, hi, _ = bucket
    return random.randint(lo, hi)


def urgency_date_range(urgency: str):
    """Return (min_days_ago, max_days_ago) for last well visit."""
    ranges = {
        "Critical":  (700, 1500),   # ~2-4 years ago  (2022-2023)
        "High":      (365, 699),    # ~1-2 years ago  (2024-2025)
        "Medium":    (180, 364),    # ~6-12 months    (2025)
        "Low":       (30,  179),    # ~1-6 months     (2025-2026)
        "On Track":  (1,   45),     # very recent     (2026)
    }
    return ranges[urgency]


def urgency_score(urgency: str) -> int:
    ranges = {
        "Critical":  (85, 100),
        "High":      (65,  84),
        "Medium":    (35,  64),
        "Low":       (10,  34),
        "On Track":  (1,    9),
    }
    lo, hi = ranges[urgency]
    return random.randint(lo, hi)


def outreach_status(urgency: str) -> str:
    """Critical/High more likely pending; Low/On Track can be scheduled."""
    weights = {
        "Critical":  [("pending", 80), ("contacted", 20)],
        "High":      [("pending", 65), ("contacted", 30), ("scheduled", 5)],
        "Medium":    [("pending", 55), ("contacted", 30), ("scheduled", 15)],
        "Low":       [("pending", 45), ("contacted", 35), ("scheduled", 20)],
        "On Track":  [("pending", 20), ("contacted", 30), ("scheduled", 50)],
    }
    return weighted_choice(weights[urgency])


def random_phone():
    area = random.choice(AREA_CODES)
    exchange = random.randint(200, 999)
    number = random.randint(1000, 9999)
    return f"({area}) {exchange}-{number}"


def random_email(first: str, last: str) -> str:
    first_clean = first.lower().replace("é","e").replace("á","a").replace("í","i") \
                              .replace("ó","o").replace("ú","u").replace("ü","u") \
                              .replace("ñ","n").replace("ç","c").replace("â","a") \
                              .replace("ê","e").replace("ô","o").replace("è","e") \
                              .replace("à","a").replace("ù","u").replace("-","") \
                              .replace("'","").replace(" ","")
    last_clean  = last.lower().replace("é","e").replace("á","a").replace("í","i") \
                              .replace("ó","o").replace("ú","u").replace("ü","u") \
                              .replace("ñ","n").replace("ç","c").replace("â","a") \
                              .replace("ê","e").replace("ô","o").replace("è","e") \
                              .replace("à","a").replace("ù","u").replace("-","") \
                              .replace("'","").replace(" ","")
    suffix = random.randint(10, 99)
    domain = random.choice(EMAIL_DOMAINS)
    patterns = [
        f"{first_clean}.{last_clean}@{domain}",
        f"{first_clean}{last_clean}{suffix}@{domain}",
        f"{first_clean[0]}{last_clean}@{domain}",
        f"{first_clean}{last_clean[0]}{suffix}@{domain}",
    ]
    return random.choice(patterns)


def pick_name(language: str, age: int) -> tuple[str, str]:
    pool = NAMES.get(language, NAMES["Other"])
    gender = random.choice(["m", "f"])
    first_key = f"first_{gender}"
    first = random.choice(pool[first_key])
    last = random.choice(pool["last"])
    return first, last


# ---------------------------------------------------------------------------
# Generate patients
# ---------------------------------------------------------------------------

def generate_patients(n: int) -> list[dict]:
    urgency_labels = [weighted_choice(URGENCY_WEIGHTS) for _ in range(n)]
    language_labels = [weighted_choice(LANGUAGE_WEIGHTS) for _ in range(n)]

    patients = []
    for i in range(n):
        pid = f"{ID_PREFIX}-{i + 1:04d}"
        urgency = urgency_labels[i]
        language = language_labels[i]
        age = random_age()

        first, last = pick_name(language, age)

        lo_days, hi_days = urgency_date_range(urgency)
        days_ago = random.randint(lo_days, hi_days)
        last_visit = TODAY - timedelta(days=days_ago)
        days_overdue_val = days_ago  # days since last well visit

        patients.append({
            "patient_identifier": pid,
            "first_name":         first,
            "last_name":          last,
            "age":                age,
            "days_overdue":       days_overdue_val,
            "urgency_label":      urgency,
            "urgency_score":      urgency_score(urgency),
            "preferred_language": language,
            "outreach_status":    outreach_status(urgency),
            "home_phone":         random_phone(),
            "email_address":      random_email(first, last),
            "last_well_visit":    last_visit.isoformat(),
        })

    return patients


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    patients = generate_patients(NUM_PATIENTS)

    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(patients)

    # Print summary stats
    from collections import Counter
    urgency_counts = Counter(p["urgency_label"] for p in patients)
    lang_counts    = Counter(p["preferred_language"] for p in patients)
    age_groups     = {"under 18": 0, "18-65": 0, "over 65": 0}
    for p in patients:
        a = p["age"]
        if a < 18:
            age_groups["under 18"] += 1
        elif a <= 65:
            age_groups["18-65"] += 1
        else:
            age_groups["over 65"] += 1

    print(f"Generated {len(patients)} patients → {OUTPUT_FILE}\n")
    print("Urgency distribution:")
    for label, count in sorted(urgency_counts.items()):
        pct = count / len(patients) * 100
        print(f"  {label:<12} {count:>5}  ({pct:.1f}%)")
    print("\nAge distribution:")
    for grp, count in age_groups.items():
        pct = count / len(patients) * 100
        print(f"  {grp:<12} {count:>5}  ({pct:.1f}%)")
    print("\nLanguage distribution:")
    for lang, count in sorted(lang_counts.items(), key=lambda x: -x[1]):
        pct = count / len(patients) * 100
        print(f"  {lang:<18} {count:>5}  ({pct:.1f}%)")


if __name__ == "__main__":
    main()
