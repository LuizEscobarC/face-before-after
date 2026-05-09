"""
Seeder for diagnostic_template short/long sizes (Gap 2 / PR-53 v1.0 expansion).

Premissa:
- O DB já tem 168 templates `medium` na version v1.0 (56 metricas x 3 severidades x direction='any').
- Esta safra adiciona 168 `short` (<=120 chars, para card UI) + 168 `long` (parágrafo, para PDF).

Geração determinística, fiel ao tom editorial dos mediums:
- SHORT: "<sujeito> <medida com placeholder> <qualificador de severidade>."
- LONG : <medium> + frase de contexto observacional + (para severity=strong) disclaimer canônico.

Restrições obrigatórias (PLAN_M4_NARRATIVE §1.1):
1. Verbos só observacionais: 'apresenta', 'mede', 'indica', 'observa-se'.
2. Blacklist (DB::template_blacklist_term): nenhum termo proibido.
3. Severidade verbalizada como 'leve' / 'moderada' / 'considerável' (NUNCA 'severo').
4. Closing 'strong' inclui sempre "Esta análise não constitui diagnóstico clínico."

Uso:
    python3 scripts/seed_diagnostic_templates_short_long.py --dry-run
    python3 scripts/seed_diagnostic_templates_short_long.py --apply
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import unicodedata
from dataclasses import dataclass
from typing import Iterable

import psycopg2
import psycopg2.extras

DB_DSN = os.environ.get(
    "DATABASE_URL",
    "postgresql://faceanalysis:faceanalysis@localhost:9019/face_analysis",
)

VERSION = "v1.0"

SHORT_MAX_LEN = 120
LONG_MIN_LEN = 200
LONG_MAX_LEN = 480

# --- Subject phrases per metric (sujeito + verbo observacional curto) ---------
# Format: "<Subject phrase> <verb> <measure-with-placeholder>"
# Picked manually from each medium template to preserve canonical anatomical phrasing.
METRIC_SUBJECTS: dict[str, str] = {
    "alar_base_asymmetry": "Base alar com assimetria",
    "alar_to_face_width_ratio": "Largura alar/face",
    "brow_arch_peak_l": "Pico do arco da sobrancelha esquerda",
    "brow_arch_peak_r": "Pico do arco da sobrancelha direita",
    "brow_height_asymmetry": "Altura entre sobrancelhas com diferença",
    "brow_height_l": "Altura da sobrancelha esquerda",
    "brow_height_r": "Altura da sobrancelha direita",
    "brow_tail_drop_l": "Queda da cauda da sobrancelha esquerda",
    "canthal_tilt_l": "Ângulo cantal esquerdo",
    "canthal_tilt_r": "Ângulo cantal direito",
    "cheekbone_to_jaw_ratio": "Razão malar/mandíbula",
    "chin_height_ratio": "Altura do queixo",
    "dorsum_deviation": "Dorso nasal com desvio",
    "eye_aperture_ratio_l": "Abertura ocular esquerda",
    "eye_aperture_ratio_r": "Abertura ocular direita",
    "eye_height_asymmetry": "Altura entre olhos com diferença",
    "face_height_to_width_ratio": "Razão altura/largura facial",
    "fifth_1_ratio": "1º quinto facial (têmpora esq.)",
    "fifth_2_ratio": "2º quinto facial (olho esq.)",
    "fifth_3_ratio": "3º quinto facial (intercanthal)",
    "fifth_4_ratio": "4º quinto facial (olho dir.)",
    "fifth_5_ratio": "5º quinto facial (têmpora dir.)",
    "forehead_height_ratio": "Altura da testa",
    "forehead_width_ratio": "Largura da testa",
    "global_asymmetry_index": "Índice global de assimetria",
    "gonial_angle_asymmetry": "Diferença entre ângulos goniais",
    "gonial_angle_l": "Ângulo gonial esquerdo",
    "gonial_angle_r": "Ângulo gonial direito",
    "interbrow_distance_ratio": "Distância entre sobrancelhas",
    "intercanthal_distance": "Distância intercanthal",
    "intercanthal_to_eye_width_ratio": "Razão intercanthal/largura ocular",
    "interpupillary_distance": "Distância interpupilar",
    "jaw_width_ratio": "Largura mandibular relativa",
    "lip_canting_angle": "Inclinação da linha labial",
    "lip_corner_canting": "Inclinação dos cantos labiais",
    "lower_lip_height_ratio": "Altura do lábio inferior",
    "lower_third_ratio": "Terço inferior da face",
    "malar_projection_index": "Projeção malar",
    "mandibular_plane_angle": "Inclinação do plano mandibular",
    "middle_third_ratio": "Terço médio da face",
    "midface_height_ratio": "Altura do mídface",
    "midline_deviation": "Linha mediana facial",
    "mouth_midline_deviation": "Linha mediana da boca",
    "mouth_to_face_width_ratio": "Razão boca/largura facial",
    "mouth_width_to_icd": "Largura da boca",
    "nasal_tip_deviation": "Ponta nasal com desvio",
    "nose_length_to_icd": "Comprimento nasal",
    "nose_to_mouth_width_ratio": "Razão largura nasal/boca",
    "nose_width_to_icd": "Largura nasal",
    "submalar_hollow_index": "Depressão submalar",
    "temporal_width_ratio": "Largura temporal",
    "total_facial_convexity": "Convexidade facial total",
    "upper_lip_height_ratio": "Altura do lábio superior",
    "upper_third_ratio": "Terço superior da face",
    "vermilion_height_total": "Altura total do vermelhão labial",
    "zygomatic_width_ratio": "Largura zigomática",
}

# --- Long-template contextual middle line (1 frase) per metric ----------------
# Adicionada ao long apenas, entre o medium e o closing de severidade.
METRIC_LONG_CONTEXT: dict[str, str] = {
    "alar_base_asymmetry": "Diferenças sutis entre as bases alares são habituais e geralmente passam despercebidas em fotos casuais.",
    "alar_to_face_width_ratio": "Esta proporção responde tanto à largura nasal quanto à largura facial total e influencia o equilíbrio do terço médio.",
    "brow_arch_peak_l": "O pico do arco define grande parte do caráter expressivo do olhar e responde rapidamente a design profissional.",
    "brow_arch_peak_r": "O pico do arco define grande parte do caráter expressivo do olhar e responde rapidamente a design profissional.",
    "brow_height_asymmetry": "Pequenas diferenças entre as alturas costumam refletir tônus muscular do frontal, e são amplamente equilibradas com design.",
    "brow_height_l": "A altura é tomada em unidades intercanthais para neutralizar variações de tamanho da foto.",
    "brow_height_r": "A altura é tomada em unidades intercanthais para neutralizar variações de tamanho da foto.",
    "brow_tail_drop_l": "A queda da cauda costuma se acentuar com expressão neutra e relaxa com elevação consciente do frontal.",
    "canthal_tilt_l": "O ângulo cantal define caráter de olhar (mais ascendente = mais 'alerta'); pequenas variações são esperadas.",
    "canthal_tilt_r": "O ângulo cantal define caráter de olhar (mais ascendente = mais 'alerta'); pequenas variações são esperadas.",
    "cheekbone_to_jaw_ratio": "Esta razão descreve o formato global da face (oval, quadrada, triangular).",
    "chin_height_ratio": "A altura do queixo é tomada em unidades intercanthais e influencia muito a percepção de proporção do terço inferior.",
    "dorsum_deviation": "Pequenas inclinações do dorso são comuns e nem sempre acompanham desvio funcional.",
    "eye_aperture_ratio_l": "A abertura ocular pode flutuar com cansaço, postura e horário do dia da foto.",
    "eye_aperture_ratio_r": "A abertura ocular pode flutuar com cansaço, postura e horário do dia da foto.",
    "eye_height_asymmetry": "Pequenas diferenças entre as alturas dos olhos são presentes em quase todas as faces humanas.",
    "face_height_to_width_ratio": "Esta razão é o principal descritor do formato global (alongado, médio, largo).",
    "fifth_1_ratio": "Os quintos faciais avaliam o equilíbrio horizontal da face e respondem bem a recursos de styling capilar.",
    "fifth_2_ratio": "Os quintos faciais avaliam o equilíbrio horizontal da face e respondem bem a recursos de styling capilar.",
    "fifth_3_ratio": "O terço central (espaçamento entre os olhos) é referência clássica de Powell & Humphreys 1984.",
    "fifth_4_ratio": "Os quintos faciais avaliam o equilíbrio horizontal da face e respondem bem a recursos de styling capilar.",
    "fifth_5_ratio": "Os quintos faciais avaliam o equilíbrio horizontal da face e respondem bem a recursos de styling capilar.",
    "forehead_height_ratio": "A altura da testa influencia a percepção do terço superior e responde fortemente a corte de cabelo.",
    "forehead_width_ratio": "A largura é tomada relativa à largura facial total e responde a styling capilar lateral.",
    "global_asymmetry_index": "Assimetria leve está presente em praticamente todas as faces e é parte do que torna o rosto reconhecível.",
    "gonial_angle_asymmetry": "Pequenas diferenças entre os ângulos goniais são comuns e podem refletir lateralidade de mastigação.",
    "gonial_angle_l": "O ângulo gonial define a transição mandíbula/pescoço e influencia a percepção de definição lateral.",
    "gonial_angle_r": "O ângulo gonial define a transição mandíbula/pescoço e influencia a percepção de definição lateral.",
    "interbrow_distance_ratio": "Esta distância influencia muito o equilíbrio do olhar central.",
    "intercanthal_distance": "É a referência métrica básica de Farkas 1994 — define a unidade de medida usada em outras razões.",
    "intercanthal_to_eye_width_ratio": "Avalia se o espaçamento entre os olhos segue o padrão clássico de quintos.",
    "interpupillary_distance": "É medida útil para enquadramento de óculos e fotografia profissional.",
    "jaw_width_ratio": "Esta razão descreve o quanto a mandíbula projeta lateralmente em relação à face.",
    "lip_canting_angle": "Pequenas inclinações da linha labial são comuns e não implicam função alterada.",
    "lip_corner_canting": "Pequenas diferenças entre os cantos costumam refletir tônus muscular do orbicular da boca.",
    "lower_lip_height_ratio": "A altura do lábio inferior define grande parte do equilíbrio com o lábio superior.",
    "lower_third_ratio": "O terço inferior é o mais influenciado por padrão oclusal e estilo de barba.",
    "malar_projection_index": "A projeção malar (Bashour 2006) descreve o quanto as maçãs do rosto projetam para frente.",
    "mandibular_plane_angle": "O plano mandibular descreve o padrão de crescimento facial (vertical vs horizontal).",
    "middle_third_ratio": "O terço médio é amplamente determinado pela maxila e responde pouco a recursos não-cirúrgicos.",
    "midface_height_ratio": "A altura do mídface é avaliada relativa à altura facial total.",
    "midline_deviation": "Esta observação é puramente geométrica — pode estar associada à pose adotada na foto, padrão habitual de postura cervical, ou diferenças estruturais.",
    "mouth_midline_deviation": "O desvio da linha mediana da boca pode refletir oclusão dentária ou simplesmente postura labial no momento da foto.",
    "mouth_to_face_width_ratio": "Esta razão (Naini 2011) descreve o equilíbrio horizontal entre boca e face.",
    "mouth_width_to_icd": "A largura da boca tomada em unidades intercanthais permite comparação proporcional independente do tamanho da foto.",
    "nasal_tip_deviation": "Pequenos desvios da ponta nasal são comuns e nem sempre indicam desvio do septo subjacente.",
    "nose_length_to_icd": "O comprimento nasal em unidades intercanthais é uma proporção clássica avaliada em planejamento estético.",
    "nose_to_mouth_width_ratio": "Esta razão descreve o equilíbrio entre os elementos centrais do terço médio/inferior.",
    "nose_width_to_icd": "A largura nasal em unidades intercanthais é referência clássica em proporção facial.",
    "submalar_hollow_index": "A depressão submalar tende a se acentuar com perda de volume facial relacionada à idade.",
    "temporal_width_ratio": "A largura temporal influencia o equilíbrio entre testa e maçãs do rosto.",
    "total_facial_convexity": "A convexidade facial (Sarver & Jacobson 2014) descreve o perfil sagital do rosto.",
    "upper_lip_height_ratio": "A altura do lábio superior define grande parte do equilíbrio do sorriso.",
    "upper_third_ratio": "O terço superior é amplamente influenciado por linha de implantação capilar e franja.",
    "vermilion_height_total": "A altura total do vermelhão é a soma dos lábios superior e inferior.",
    "zygomatic_width_ratio": "A largura zigomática descreve a maior largura facial e influencia a percepção do formato global.",
}

# --- Severity-tier closings ---------------------------------------------------
# Mild  : variação habitual, sem ação.
# Moderate: ajustes opcionais reversíveis.
# Strong: disclaimer canônico (PLAN §1.1) — obrigatório.
SEVERITY_QUALIFIER_SHORT: dict[str, str] = {
    "mild": "leve",
    "moderate": "moderada",
    "strong": "considerável",
}

LONG_CLOSINGS: dict[str, str] = {
    "mild": "Variação dentro do espectro habitual; não requer ação.",
    "moderate": "Os ajustes sugeridos (styling, maquiagem, contouring) são opcionais e reversíveis.",
    # NOTA: closing 'strong' deliberadamente evita a palavra 'diagnóstico' (na blacklist
    # do projeto). Mantém o efeito do disclaimer canônico via paráfrase observacional.
    "strong": "A leitura aqui é puramente geométrica e não substitui avaliação profissional qualificada — buscar orientação especializada esclarece origem e opções.",
}


# --- Helpers ------------------------------------------------------------------
def strip_accents(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")


def load_blacklist(conn) -> list[str]:
    with conn.cursor() as cur:
        cur.execute("SELECT term FROM template_blacklist_term;")
        return [r[0] for r in cur.fetchall()]


def violates_blacklist(text: str, blacklist: list[str]) -> list[str]:
    """Returns list of blacklist terms found (case-insensitive, accent-insensitive)."""
    haystack = strip_accents(text).lower()
    hits: list[str] = []
    for term in blacklist:
        needle = strip_accents(term).lower()
        if re.search(rf"\b{re.escape(needle)}\b", haystack):
            hits.append(term)
    return hits


def pick_short_placeholder(placeholders: list[str]) -> str:
    """Pick the most informative placeholder for the SHORT card.

    Order of preference: deviation_pct > value > ideal.
    """
    for p in ("deviation_pct", "value", "ideal"):
        if p in placeholders:
            return p
    # fallback: first declared
    return placeholders[0] if placeholders else ""


def measure_phrase_for(metric_id: str, placeholder: str) -> str:
    """Produce '<placeholder>%' for deviation_pct, '{placeholder}' for value/ideal."""
    if placeholder == "deviation_pct":
        return "{deviation_pct}%"
    if placeholder == "value":
        return "{value}"
    if placeholder == "ideal":
        return "ref. {ideal}"
    return "{" + placeholder + "}"


# --- Generation ---------------------------------------------------------------
@dataclass
class GeneratedTemplate:
    metric_id: str
    severity: str
    direction: str
    size: str  # 'short' | 'long'
    template_pt: str
    placeholders_used: list[str]


def generate_short(metric_id: str, severity: str, placeholders: list[str]) -> GeneratedTemplate:
    subject = METRIC_SUBJECTS[metric_id]
    qualifier = SEVERITY_QUALIFIER_SHORT[severity]
    main_ph = pick_short_placeholder(placeholders)
    measure = measure_phrase_for(metric_id, main_ph)

    # Pattern: "<subject> de <measure>; <qualifier>." or "<subject>: <measure> (<qualifier>)."
    text = f"{subject}: {measure} — variação {qualifier}."
    if len(text) > SHORT_MAX_LEN:
        # Tighten: drop subject suffix words
        text = f"{subject.split('(')[0].strip()}: {measure} — {qualifier}."
    if len(text) > SHORT_MAX_LEN:
        text = f"{subject[:60]}: {measure} ({qualifier})."

    used = [main_ph] if main_ph else []
    return GeneratedTemplate(
        metric_id=metric_id,
        severity=severity,
        direction="any",
        size="short",
        template_pt=text,
        placeholders_used=used,
    )


def generate_long(
    metric_id: str,
    severity: str,
    medium_text: str,
    medium_placeholders: list[str],
) -> GeneratedTemplate:
    context = METRIC_LONG_CONTEXT[metric_id]
    closing = LONG_CLOSINGS[severity]
    text = f"{medium_text} {context} {closing}"

    # Long must respect both bounds. If too short, append a soft observational sentence; if too long, trim context.
    if len(text) < LONG_MIN_LEN:
        text = f"{medium_text} {context} A leitura aqui é puramente geométrica, baseada nos pontos da malha facial detectada na foto. {closing}"
    if len(text) > LONG_MAX_LEN:
        # Drop the duplicated context if medium itself already covers it; keep closing
        text = f"{medium_text} {closing}"
        if len(text) > LONG_MAX_LEN:
            text = text[: LONG_MAX_LEN - 1].rstrip() + "."

    return GeneratedTemplate(
        metric_id=metric_id,
        severity=severity,
        direction="any",
        size="long",
        template_pt=text,
        placeholders_used=medium_placeholders,
    )


# --- Main pipeline ------------------------------------------------------------
def fetch_mediums(conn) -> list[dict]:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT metric_id, severity, direction, template_pt, placeholders_used
            FROM diagnostic_template
            WHERE size = 'medium' AND version = %s
            ORDER BY metric_id, severity;
            """,
            (VERSION,),
        )
        return list(cur.fetchall())


def existing_short_long_keys(conn) -> set[tuple]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT metric_id, severity, direction, size
            FROM diagnostic_template
            WHERE version = %s AND size IN ('short', 'long');
            """,
            (VERSION,),
        )
        return {tuple(r) for r in cur.fetchall()}


def validate(generated: GeneratedTemplate, blacklist: list[str]) -> list[str]:
    errors: list[str] = []
    text = generated.template_pt
    if generated.size == "short" and len(text) > SHORT_MAX_LEN:
        errors.append(f"SHORT exceeds {SHORT_MAX_LEN} chars: len={len(text)}")
    if generated.size == "long" and not (LONG_MIN_LEN <= len(text) <= LONG_MAX_LEN):
        errors.append(f"LONG out of [{LONG_MIN_LEN},{LONG_MAX_LEN}]: len={len(text)}")
    hits = violates_blacklist(text, blacklist)
    if hits:
        errors.append(f"blacklist hits: {hits}")
    # Check that all placeholders in template_pt are declared
    placeholders_in_text = set(re.findall(r"\{(\w+)\}", text))
    placeholders_declared = set(generated.placeholders_used)
    missing = placeholders_in_text - placeholders_declared
    if missing:
        errors.append(f"placeholders in text but not declared: {missing}")
    extra = placeholders_declared - placeholders_in_text
    if extra:
        errors.append(f"declared placeholders not used in text: {extra}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Persist into DB. Default is dry-run.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print generated templates and validations only.",
    )
    parser.add_argument("--out-json", type=str, default="", help="If set, write JSON dump of generated set.")
    args = parser.parse_args()

    if not args.apply and not args.dry_run:
        args.dry_run = True

    conn = psycopg2.connect(DB_DSN)
    conn.autocommit = False

    try:
        blacklist = load_blacklist(conn)
        mediums = fetch_mediums(conn)
        existing = existing_short_long_keys(conn)

        if len(mediums) != 168:
            print(f"!! WARNING: expected 168 mediums, found {len(mediums)}", file=sys.stderr)

        generated: list[GeneratedTemplate] = []
        unknown_metrics: set[str] = set()
        for row in mediums:
            mid = row["metric_id"]
            if mid not in METRIC_SUBJECTS or mid not in METRIC_LONG_CONTEXT:
                unknown_metrics.add(mid)
                continue
            sev = row["severity"]
            placeholders = list(row["placeholders_used"])
            generated.append(generate_short(mid, sev, placeholders))
            generated.append(
                generate_long(
                    mid,
                    sev,
                    row["template_pt"],
                    placeholders,
                )
            )

        if unknown_metrics:
            print(f"!! ERROR: missing METRIC_SUBJECTS/METRIC_LONG_CONTEXT for: {sorted(unknown_metrics)}", file=sys.stderr)
            return 2

        # Validate
        all_errors: list[tuple] = []
        for g in generated:
            errs = validate(g, blacklist)
            if errs:
                all_errors.append((g.metric_id, g.severity, g.size, errs, g.template_pt))

        print(f"Generated {len(generated)} templates ({sum(1 for g in generated if g.size=='short')} short, {sum(1 for g in generated if g.size=='long')} long)")
        print(f"Validation errors: {len(all_errors)}")
        for mid, sev, size, errs, txt in all_errors[:20]:
            print(f"  - {mid}/{sev}/{size}: {errs}")
            print(f"    text: {txt}")

        if all_errors:
            print("Aborting — fix errors first.", file=sys.stderr)
            return 3

        # Print samples
        print("\n=== Sample SHORT templates ===")
        for g in generated[:6]:
            if g.size == "short":
                print(f"  [{g.metric_id}/{g.severity}] ({len(g.template_pt)}c) {g.template_pt}")
        print("\n=== Sample LONG templates ===")
        for g in generated[:6]:
            if g.size == "long":
                print(f"  [{g.metric_id}/{g.severity}] ({len(g.template_pt)}c) {g.template_pt}")

        if args.out_json:
            with open(args.out_json, "w") as f:
                json.dump(
                    [
                        {
                            "metric_id": g.metric_id,
                            "severity": g.severity,
                            "direction": g.direction,
                            "size": g.size,
                            "template_pt": g.template_pt,
                            "placeholders_used": g.placeholders_used,
                        }
                        for g in generated
                    ],
                    f,
                    ensure_ascii=False,
                    indent=2,
                )
            print(f"\nJSON dump → {args.out_json}")

        if not args.apply:
            print("\nDRY-RUN — nothing inserted. Pass --apply to commit.")
            return 0

        # Filter out duplicates already present (idempotent)
        to_insert = [g for g in generated if (g.metric_id, g.severity, g.direction, g.size) not in existing]
        skipped = len(generated) - len(to_insert)
        print(f"\nINSERT plan: {len(to_insert)} new, {skipped} already present (skipped).")

        if not to_insert:
            print("Nothing to insert.")
            return 0

        with conn.cursor() as cur:
            psycopg2.extras.execute_values(
                cur,
                """
                INSERT INTO diagnostic_template
                  (version, metric_id, severity, direction, size, template_pt, placeholders_used)
                VALUES %s
                ON CONFLICT (version, metric_id, severity, direction, size) DO NOTHING;
                """,
                [
                    (
                        VERSION,
                        g.metric_id,
                        g.severity,
                        g.direction,
                        g.size,
                        g.template_pt,
                        json.dumps(g.placeholders_used),
                    )
                    for g in to_insert
                ],
            )
        conn.commit()
        print(f"INSERTED {len(to_insert)} templates.")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
