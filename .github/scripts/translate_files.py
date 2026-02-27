import os
import sys
import time
from pathlib import Path
import google.generativeai as genai

# ──────────────────────────────────────────────
# Configuration
# ────────────────────────��─────────────────────
SUPPORTED_EXTENSIONS = {
    ".md", ".txt", ".rst", ".html", ".htm",
    ".json", ".yaml", ".yml", ".csv", ".xml",
    ".py", ".js", ".ts", ".java", ".go",
    ".c", ".cpp", ".cs", ".rb", ".php",
    ".sh", ".bash", ".toml", ".ini", ".cfg"
}

SKIP_DIRS = {
    ".git", "node_modules", "__pycache__",
    ".venv", "venv", "dist", "build", ".github"
}

# Free tier: 15 requests per minute → wait 4s between requests to stay safe
REQUEST_DELAY_SECONDS = 4

# ──────────────────────────────────────────────
# Init Gemini
# ──────────────────────────────────────────────
genai.configure(api_key=os.environ["GEMINI_API_KEY"])
model = genai.GenerativeModel("gemini-2.0-flash")


def should_translate(text: str) -> bool:
    """Skip files that are empty or too short to translate."""
    return len(text.strip()) > 20


def translate_to_english(content: str, file_ext: str) -> str:
    """Translate content to English while strictly preserving format."""
    prompt = f"""You are a professional translator. Translate the following file content to English.

CRITICAL RULES — YOU MUST FOLLOW ALL OF THEM:
1. Preserve ALL formatting EXACTLY: indentation, line breaks, blank lines, spacing, tabs.
2. Do NOT translate: code syntax, variable names, function names, class names, import statements,
   file paths, URLs, HTML/XML tags, JSON keys, YAML keys, command-line flags, regex patterns,
   package names, or any technical identifiers.
3. Only translate: human-readable natural language text, comments, string values that are
   natural language sentences, documentation text, and descriptions.
4. Keep the EXACT same file structure and format as the input — character for character except
   for the translated human-readable text.
5. Do NOT add any extra explanation, markdown code fences, or wrapper text.
6. If the content is already fully in English, return it UNCHANGED.
7. File type: {file_ext}

Content:
{content}"""

    response = model.generate_content(
        prompt,
        generation_config=genai.types.GenerationConfig(temperature=0.1),
    )
    return response.text


def get_all_files(root: Path):
    """Recursively yield all translatable files."""
    for path in sorted(root.rglob("*")):
        if path.is_file():
            if any(part in SKIP_DIRS for part in path.parts):
                continue
            if path.suffix.lower() in SUPPORTED_EXTENSIONS:
                yield path


def main():
    root = Path(".")
    files = list(get_all_files(root))
    total = len(files)
    print(f"Found {total} translatable file(s).\n")

    success = 0
    skipped = 0
    errors = 0

    for i, file_path in enumerate(files, 1):
        try:
            original = file_path.read_text(encoding="utf-8", errors="ignore")

            if not should_translate(original):
                print(f"[{i}/{total}] ⏭️  Skipping (empty/too short): {file_path}")
                skipped += 1
                continue

            print(f"[{i}/{total}] 🌐 Translating: {file_path} ...")
            translated = translate_to_english(original, file_path.suffix)

            # Write back in-place, preserving the original filename & location
            file_path.write_text(translated, encoding="utf-8")
            print(f"[{i}/{total}] ✅ Done: {file_path}")
            success += 1

            # Respect free-tier rate limit (15 RPM = 1 req/4s)
            if i < total:
                time.sleep(REQUEST_DELAY_SECONDS)

        except Exception as e:
            print(f"[{i}/{total}] ⚠️  Error translating {file_path}: {e}", file=sys.stderr)
            errors += 1
            # Wait before retrying next file to avoid cascading rate-limit errors
            time.sleep(REQUEST_DELAY_SECONDS)

    print(f"\n── Summary ──────────────────────")
    print(f"  ✅ Translated : {success}")
    print(f"  ⏭️  Skipped   : {skipped}")
    print(f"  ⚠️  Errors    : {errors}")
    print(f"  📁 Total     : {total}")
    print(f"─────────────────────────────────")


if __name__ == "__main__":
    main()
