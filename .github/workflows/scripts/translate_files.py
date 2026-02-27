import os
import sys
from pathlib import Path
from openai import OpenAI

# ──────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────
SUPPORTED_EXTENSIONS = {
    ".md", ".txt", ".rst", ".html", ".htm",
    ".json", ".yaml", ".yml", ".csv", ".xml",
    ".py", ".js", ".ts", ".java", ".go",
    ".c", ".cpp", ".cs", ".rb", ".php",
    ".sh", ".bash", ".toml", ".ini", ".cfg"
}

# Directories to skip entirely
SKIP_DIRS = {
    ".git", "node_modules", "__pycache__",
    ".venv", "venv", "dist", "build", ".github"
}

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])


def should_translate(text: str) -> bool:
    """Skip files that are already in English or purely code/data."""
    # Basic heuristic: skip very short files
    return len(text.strip()) > 20


def translate_to_english(content: str, file_ext: str) -> str:
    """Translate content to English while preserving format."""
    prompt = f"""You are a professional translator. Translate the following file content to English.

CRITICAL RULES:
1. Preserve ALL formatting exactly: indentation, line breaks, blank lines, spacing.
2. Do NOT translate: code syntax, variable names, function names, class names, import statements, file paths, URLs, HTML/XML tags, JSON keys, YAML keys, command-line flags, regex patterns, or any technical identifiers.
3. Only translate: human-readable text, comments, string values that are natural language, documentation, and descriptions.
4. Keep the exact same file structure and format as the input.
5. Do NOT add any extra text, explanations, or markdown wrappers.
6. File type: {file_ext}

Content to translate:
{content}"""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,  # Low temperature for consistent, accurate translation
    )
    return response.choices[0].message.content


def get_all_files(root: Path):
    """Recursively yield all translatable files."""
    for path in root.rglob("*"):
        if path.is_file():
            # Skip hidden/system directories
            if any(part in SKIP_DIRS for part in path.parts):
                continue
            if path.suffix.lower() in SUPPORTED_EXTENSIONS:
                yield path


def main():
    root = Path(".")
    files = list(get_all_files(root))
    print(f"Found {len(files)} translatable file(s).")

    for file_path in files:
        try:
            original = file_path.read_text(encoding="utf-8", errors="ignore")

            if not should_translate(original):
                print(f"  Skipping (too short or empty): {file_path}")
                continue

            print(f"  Translating: {file_path} ...")
            translated = translate_to_english(original, file_path.suffix)

            # Write back in-place, preserving the original file
            file_path.write_text(translated, encoding="utf-8")
            print(f"  ✅ Done: {file_path}")

        except Exception as e:
            print(f"  ⚠️  Error translating {file_path}: {e}", file=sys.stderr)

    print("\n✅ Translation complete.")


if __name__ == "__main__":
    main()
