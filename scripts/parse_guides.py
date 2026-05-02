#!/usr/bin/env python3
"""Parsea las guías .md a JSON estructurado para la app."""
import os, re, json, sys

GUIAS_DIR = "/tmp/guias_text"
OUT_DIR = "/home/claude/normas-app/www/assets/data"
os.makedirs(OUT_DIR, exist_ok=True)

# Mapa de IDs (extraído del nombre de archivo) a metadata
def normalize_id(filename):
    # guia_nmx_c_435.md -> NMX-C-435
    # guia_nmx_c_109-1.md -> NMX-C-109-1
    base = filename.replace("guia_nmx_c_", "").replace(".md", "")
    return f"NMX-C-{base.upper()}"

def parse_table(lines, start_idx):
    """Parsea una tabla markdown que empieza en start_idx, regresa (rows, end_idx)."""
    rows = []
    i = start_idx
    while i < len(lines):
        line = lines[i].rstrip()
        if not line.startswith("|"):
            break
        # Saltar separadores tipo | --- | --- |
        cells = [c.strip() for c in line.split("|")[1:-1]]
        if all(re.match(r"^-+$", c) for c in cells if c):
            i += 1
            continue
        rows.append(cells)
        i += 1
    return rows, i

def parse_md(md_text):
    """Convierte el markdown en lista de bloques estructurados."""
    lines = md_text.split("\n")
    blocks = []
    i = 0
    list_buffer = []

    def flush_list():
        nonlocal list_buffer
        if list_buffer:
            blocks.append({"type": "list", "items": list_buffer})
            list_buffer = []

    while i < len(lines):
        line = lines[i].rstrip()

        # Línea vacía
        if not line:
            flush_list()
            i += 1
            continue

        # Encabezado # -> Parte
        if line.startswith("# "):
            flush_list()
            blocks.append({"type": "h1", "text": clean_md(line[2:])})
            i += 1
            continue

        # Encabezado ## -> Sección
        if line.startswith("## "):
            flush_list()
            blocks.append({"type": "h2", "text": clean_md(line[3:])})
            i += 1
            continue

        if line.startswith("### "):
            flush_list()
            blocks.append({"type": "h3", "text": clean_md(line[4:])})
            i += 1
            continue

        # Tabla
        if line.startswith("|"):
            flush_list()
            rows, new_i = parse_table(lines, i)
            if rows:
                # Si la tabla es de UNA sola celda con texto largo, tratarla como callout
                if len(rows) == 1 and len(rows[0]) == 1:
                    blocks.append({"type": "callout", "text": clean_md(rows[0][0])})
                else:
                    blocks.append({"type": "table", "rows": [[clean_md(c) for c in r] for r in rows]})
            i = new_i
            continue

        # Lista con bullet
        if line.startswith("- "):
            list_buffer.append(clean_md(line[2:]))
            i += 1
            continue

        # Cita en cursiva sola (subtítulo)
        if line.startswith("*") and line.endswith("*") and not line.startswith("**"):
            flush_list()
            blocks.append({"type": "subtitle", "text": clean_md(line)})
            i += 1
            continue

        # Párrafo normal
        flush_list()
        blocks.append({"type": "p", "text": clean_md(line)})
        i += 1

    flush_list()
    return blocks

def clean_md(text):
    """Convierte negrita/cursiva markdown a HTML inline simple, conserva resto."""
    # **negrita** -> <strong>
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    # *cursiva* -> <em>
    text = re.sub(r"(?<!\*)\*([^\*]+?)\*(?!\*)", r"<em>\1</em>", text)
    return text.strip()

def extract_metadata(blocks):
    """Extrae metadata del header de la guía."""
    meta = {
        "subtitle": "",       # "Guía NMX-C-435 · Aprendizaje profundo"
        "kind": "",           # "GUÍA DE APRENDIZAJE PROFUNDO"
        "code": "",           # "NMX-C-435-ONNCCE-2010"
        "category": "",       # "Industria de la Construcción · Concreto Hidráulico"
        "title": "",          # "Determinación de la Temperatura del Concreto Fresco"
        "validity": "",       # "Declaratoria de Vigencia D.O.F. 06 de enero de 2011"
        "intro_callout": ""   # El "Para quién es esta guía"
    }
    for b in blocks[:8]:
        if b["type"] == "subtitle" and not meta["subtitle"]:
            meta["subtitle"] = strip_html(b["text"])
        elif b["type"] == "p":
            t = strip_html(b["text"])
            if "GUÍA" in t.upper() and not meta["kind"]:
                meta["kind"] = t
            elif re.match(r"NMX-C-\d", t) and not meta["code"]:
                meta["code"] = t
            elif "Industria" in t and not meta["category"]:
                meta["category"] = t
            elif "Vigencia" in t.lower() or "D.O.F" in t:
                meta["validity"] = t
            elif not meta["title"] and len(t) > 20 and not t.startswith("*"):
                meta["title"] = t
        elif b["type"] == "callout" and "Para quién" in b["text"]:
            meta["intro_callout"] = b["text"]
            break
    return meta

def strip_html(text):
    return re.sub(r"<[^>]+>", "", text).strip()

def split_into_parts(blocks):
    """Divide los bloques en partes (cada h1) — devuelve lista de partes con sus bloques."""
    parts = []
    current = None
    intro_blocks = []
    for b in blocks:
        if b["type"] == "h1":
            if current:
                parts.append(current)
            current = {"title": strip_html(b["text"]), "blocks": []}
        else:
            if current is None:
                intro_blocks.append(b)
            else:
                current["blocks"].append(b)
    if current:
        parts.append(current)
    return parts, intro_blocks

def extract_search_text(parts):
    """Saca un texto plano para indexar búsquedas."""
    out = []
    for p in parts:
        out.append(p["title"])
        for b in p["blocks"]:
            if b["type"] in ("p", "h2", "h3", "subtitle"):
                out.append(strip_html(b["text"]))
            elif b["type"] == "callout":
                out.append(strip_html(b["text"]))
            elif b["type"] == "list":
                for it in b["items"]:
                    out.append(strip_html(it))
            elif b["type"] == "table":
                for row in b["rows"]:
                    for c in row:
                        out.append(strip_html(c))
    return " ".join(out)

def detect_evaluation_part(parts):
    """Identifica la parte que contiene errores frecuentes o autoevaluación.
    Devuelve el índice principal (para compatibilidad).
    """
    candidates = []
    for idx, p in enumerate(parts):
        t = p["title"].lower()
        if ("autoevaluación" in t or
            "errores frecuentes" in t or
            "autoevaluacion" in t):
            candidates.append(idx)
    if not candidates:
        return None
    return candidates[-1]

def detect_evaluation_parts(parts):
    """Devuelve TODAS las partes que tienen errores o autoevaluación."""
    return [idx for idx, p in enumerate(parts)
            if ("autoevaluación" in p["title"].lower() or
                "errores frecuentes" in p["title"].lower() or
                "autoevaluacion" in p["title"].lower())]

# ================================
# Procesar todas las guías
# ================================
manifest = []

for fn in sorted(os.listdir(GUIAS_DIR)):
    if not fn.endswith(".md"):
        continue

    md = open(os.path.join(GUIAS_DIR, fn), "r", encoding="utf-8").read()
    blocks = parse_md(md)
    meta = extract_metadata(blocks)
    parts, intro_blocks = split_into_parts(blocks)
    eval_idx = detect_evaluation_part(parts)

    nmx_id = normalize_id(fn)
    # ID corto para el sistema (slug)
    slug = nmx_id.lower().replace("nmx-c-", "c").replace("-", "_")

    out = {
        "id": nmx_id,
        "slug": slug,
        "metadata": meta,
        "intro_blocks": intro_blocks,
        "parts": parts,
        "eval_part_index": eval_idx,
        "eval_part_indices": detect_evaluation_parts(parts),
        "search_text": extract_search_text(parts).lower()
    }

    out_path = os.path.join(OUT_DIR, f"{slug}.json")
    json.dump(out, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

    manifest.append({
        "id": nmx_id,
        "slug": slug,
        "title": meta["title"],
        "category": meta["category"],
        "code": meta["code"],
        "subtitle": meta["subtitle"],
        "parts_count": len(parts),
        "file": f"{slug}.json"
    })
    print(f"  {nmx_id:18} -> {len(parts)} partes, {os.path.getsize(out_path):,} bytes")

# Asignar categorías manualmente (basado en clasificación del usuario)
CATEGORIAS = {
    "NMX-C-083":   "Concreto",   "NMX-C-109-1": "Concreto",
    "NMX-C-148":   "Concreto",   "NMX-C-156-1": "Concreto",
    "NMX-C-159":   "Concreto",   "NMX-C-161-1": "Concreto",
    "NMX-C-431-2": "Geotecnia",  "NMX-C-435":   "Concreto",
    "NMX-C-467-1": "Geotecnia",  "NMX-C-468-1": "Geotecnia",
    "NMX-C-475-1": "Geotecnia",  "NMX-C-476-1": "Geotecnia",
    "NMX-C-511-1": "Geotecnia"
}

# Orden ONNCCE (oficial del compendio)
ORDER = [
    "NMX-C-161-1", "NMX-C-156-1", "NMX-C-435", "NMX-C-159",
    "NMX-C-148", "NMX-C-109-1", "NMX-C-083",
    "NMX-C-431-2", "NMX-C-467-1", "NMX-C-468-1",
    "NMX-C-475-1", "NMX-C-476-1", "NMX-C-511-1"
]
order_map = {nmx_id: i for i, nmx_id in enumerate(ORDER)}

import re as _re
for entry in manifest:
    entry["category"] = CATEGORIAS.get(entry["id"], "Concreto")
    entry["order"] = order_map.get(entry["id"], 999)
    # Cargar JSON individual para enriquecer
    full = json.load(open(os.path.join(OUT_DIR, entry["file"]), encoding="utf-8"))
    entry["code_full"] = full["metadata"]["code"]
    intro = full["metadata"]["intro_callout"]
    intro_clean = _re.sub(r"<[^>]+>", "", intro)
    intro_clean = intro_clean.replace("Para quién es esta guía", "").strip()
    entry["short_description"] = intro_clean.split(".")[0][:200] + "..."

# Reordenar
manifest.sort(key=lambda e: e["order"])

# Manifest global
json.dump(manifest, open(os.path.join(OUT_DIR, "manifest.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=2)

print(f"\nTotal: {len(manifest)} guías procesadas en {OUT_DIR}")
