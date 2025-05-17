# Regular Expressions Reference

This document provides a reference for key regular expressions used in the project. Each entry includes its purpose, context, the regex pattern, an explanation, and illustrative examples.

---

## 1. General Dialogue Line Extractor

*   **Purpose:** Extracts a speaker's name and their dialogue from a standard transcript line.
*   **Original Context:** `fine-tune-manager/src/data/extractor.py` (as `character_pattern`)
*   **Regex (Python):** `^\s*([A-Z][A-Z0-9\s\-]*[A-Z0-9]):\s*(.+)`
*   **Node.js Equivalent:** `/^\s*([A-Z][A-Z0-9\s-]*[A-Z0-9]):\s*(.+)/`

### Explanation
*   `^\s*`: Line starts with optional whitespace.
*   `([A-Z][A-Z0-9\s\-]*[A-Z0-9])`: Captures the speaker (Group 1). Must start and end with an uppercase letter or digit, can contain uppercase letters, digits, spaces, or hyphens.
*   `:\s*`: A colon followed by optional whitespace.
*   `(.+)`: Captures the dialogue (Group 2).

### Examples

**Input 1:**
```js
"PICARD: Make it so."
```
*   **Match?** Yes
*   **Group 1 (Speaker):**
    ```js
    "PICARD"
    ```
*   **Group 2 (Dialogue):**
    ```js
    "Make it so."
    ```

**Input 2:**
```js
"  DATA: Fascinating."
```
*   **Match?** Yes
*   **Group 1 (Speaker):**
    ```js
    "DATA"
    ```
*   **Group 2 (Dialogue):**
    ```js
    "Fascinating."
    ```

**Input 3:**
```js
"COMMANDER SATO: Message incoming."
```
*   **Match?** Yes
*   **Group 1 (Speaker):**
    ```js
    "COMMANDER SATO"
    ```
*   **Group 2 (Dialogue):**
    ```js
    "Message incoming."
    ```

**Input 4:**
```js
"R2-D2: (beeps)"
```
*   **Match?** Yes
*   **Group 1 (Speaker):**
    ```js
    "R2-D2"
    ```
*   **Group 2 (Dialogue):**
    ```js
    "(beeps)"
    ```

**Input 5 (No Match - Lowercase Speaker):**
```js
"lowercase: text"
```
*   **Match?** No

**Input 6 (No Match - Missing Colon):**
```js
"PICARD No colon"
```
*   **Match?** No

**Input 7 (Double Colon - Group 2 includes extra colon):**
```js
"VOICE OVER:: Something"
```
*   **Match?** Yes
*   **Group 1 (Speaker):**
    ```js
    "VOICE OVER"
    ```
*   **Group 2 (Dialogue):**
    ```js
    ": Something"
    ```
---

## 2. Movie Script Line Number / Omitted Scene Filter

*   **Purpose:** Identifies and filters out lines in movie scripts that are line numbers or "OMITTED" scene markers.
*   **Original Context:** `utils/grep_character_lines.py` (as `movie_line_number_regex`)
*   **Regex (Python):** `^(?:\s*\d+\s+(?:[A-Z\s.]+(?:-\s*[A-Z]+)?)\s+\d+\s*|\s*\d+\s+OMITTED\s*\d*\s*)$`
*   **Node.js Equivalent:** `/^(?:\s*\d+\s+(?:[A-Z\s.]+(?:-\s*[A-Z]+)?)\s+\d+\s*|\s*\d+\s+OMITTED\s*\d*\s*)$/`

### Explanation
Matches an entire line if it's:
1.  A numbered line/scene header (e.g., ` 10 INT. BRIDGE 10 `)
2.  An "OMITTED" line (e.g., ` 12 OMITTED `)

### Examples

**Input 1 (Numbered Scene Header):**
```js
"101   INT. COMMAND CENTER   101"
```
*   **Match?** Yes (Behavior: Filter out / Skip)

**Input 2 (Numbered Line with Continuation):**
```js
"  23   PICARD - CONT'D   23  "
```
*   **Match?** Yes (Behavior: Filter out / Skip)

**Input 3 (Omitted Line):**
```js
"42 OMITTED"
```
*   **Match?** Yes (Behavior: Filter out / Skip)

**Input 4 (Omitted Line with Numbers):**
```js
"  5 OMITTED 99  "
```
*   **Match?** Yes (Behavior: Filter out / Skip)

**Input 5 (Dialogue - No Match):**
```js
"PICARD: Engage."
```
*   **Match?** No (Behavior: Keep)

**Input 6 (Partial Omitted - No Match if not fitting full pattern):**
```js
"OMITTED"
```
*   **Match?** No (Behavior: Keep)

**Input 7 (Scene Description - No Match):**
```js
"100 SCENE START"
```
*   **Match?** No (Behavior: Keep)

---

## 3. Transcript Footer Filter

*   **Purpose:** Identifies and filters out common footer lines (e.g., a link back to an episode index).
*   **Original Context:** `utils/grep_character_lines.py` (as `footer_regex`)
*   **Regex (Python):** `^\s*<Back to the episode listing`
*   **Node.js Equivalent:** `/^\s*<Back to the episode listing/`

### Explanation
Matches lines starting with optional whitespace followed by the literal string `<Back to the episode listing`.

### Examples

**Input 1:**
```js
"<Back to the episode listing"
```
*   **Match?** Yes (Behavior: Filter out / Skip)

**Input 2 (With leading space):**
```js
"  <Back to the episode listing"
```
*   **Match?** Yes (Behavior: Filter out / Skip)

**Input 3 (With trailing text):**
```js
"<Back to the episode listing via this link"
```
*   **Match?** Yes (Behavior: Filter out / Skip)

**Input 4 (Regular Text - No Match):**
```js
"Episode 1: The Return"
```
*   **Match?** No (Behavior: Keep)

---

## 4. Cue Start Identifier

*   **Purpose:** Identifies the start of various "cues" (dialogue, actions, log entries).
*   **Original Context:** `utils/grep_character_lines.py` (as `cue_start_regex`); Used in `parser.ts` as `REGEX.CUE_START`.
*   **Regex (Python):** `^\s*(?:(?:[A-Z0-9][A-Z0-9\s,'-]*_*(?:\s*\(.*\))?):|\(.*\)|\[.*\]|(?:Stardate|Captain's log|Original Airdate):)`
*   **Node.js Equivalent (as in parser.ts):** `/^\s*(?:(?:[A-Z0-9][A-Z0-9\s,'-]*_*(?:\s*\([^)]*?\))?):|\([^)]*?\)|\[.*?]|(?:Stardate|Captain's log|Original Airdate):)/`
    *Note: `parser.ts` uses non-greedy `[^)]*?` and `.*?` inside parentheses/brackets which is generally safer.*

### Explanation
Matches lines starting with optional whitespace and one of the following patterns:
1.  Speaker name (uppercase, numbers, spaces, commas, apostrophes, hyphens), optionally followed by `(V.O.)`-like suffix, then a colon.
2.  Text enclosed in parentheses `(...)`.
3.  Text enclosed in square brackets `[...]`.
4.  "Stardate:", "Captain's log:", or "Original Airdate:".

### Examples

**Input 1 (Speaker with Colon):**
```js
"PICARD: Make it so."
```
*   **Match?** Yes
*   **Matched Part (Illustrative):** `"PICARD:"`

**Input 2 (Speaker with Suffix and Colon):**
```js
"KIRA (on comm): Report."
```
*   **Match?** Yes
*   **Matched Part (Illustrative):** `"KIRA (on comm):"`

**Input 3 (Parenthetical Action):**
```js
"  (He smiles)"
```
*   **Match?** Yes
*   **Matched Part (Illustrative):** `"(He smiles)"`

**Input 4 (Bracketed Direction):**
```js
"[Bridge shakes]"
```
*   **Match?** Yes
*   **Matched Part (Illustrative):** `"[Bridge shakes]"`

**Input 5 (Stardate):**
```js
"Stardate: 47634.4"
```
*   **Match?** Yes
*   **Matched Part (Illustrative):** `"Stardate:"`

**Input 6 (Captain's Log):**
```js
"Captain's log: Supplemental."
```
*   **Match?** Yes
*   **Matched Part (Illustrative):** `"Captain's log:"`

**Input 7 (Original Airdate):**
```js
"  Original Airdate: 1995-01-23"
```
*   **Match?** Yes
*   **Matched Part (Illustrative):** `"Original Airdate:"`

**Input 8 (Plain Text - No Match):**
```js
"Just a line of text."
```
*   **Match?** No

**Input 9 (Invalid Speaker Format - No Match):**
```js
"CONTINUED:"
```
*   **Match?** No (If not matching speaker name rules, e.g., requiring uppercase start)

---

## 5. Movie Script Speaker Identifier

*   **Purpose:** Identifies speaker names in movie scripts, often indented significantly.
*   **Original Context:** `utils/grep_character_lines.py` (as `movie_speaker_regex`); Used in `parser.ts` as `REGEX.MOVIE_SPEAKER`.
*   **Regex (Python):** `^\s{10,}([A-Z][A-Z0-9\s'.]*(?:\([A-Z\s.]+\))?(?:'S\sVOICE)?)\s*$`
*   **Node.js Equivalent:** `/^\s{10,}([A-Z][A-Z0-9\s'.]*(?:\([A-Z\s.]+\))?(?:'S\sVOICE)?)\s*$/`

### Explanation
*   `^\s{10,}`: Line starts with at least 10 whitespace characters.
*   `([A-Z][A-Z0-9\s'.]*(?:\([A-Z\s.]+\))?(?:'S\sVOICE)?)`: Captures the speaker (Group 1).
    *   Starts with an uppercase letter.
    *   Can include uppercase letters, digits, spaces, apostrophes, periods.
    *   Optionally followed by `(CONT'D)` or `(O.S.)`.
    *   Optionally followed by `'S VOICE`.
*   `\s*$`: Optional trailing whitespace until the end of the line.

### Examples

**Input 1 (Indented Speaker):**
```js
"          PICARD"
```
*   **Match?** Yes
*   **Group 1 (Speaker):**
    ```js
    "PICARD"
    ```

**Input 2 (Indented Speaker with Suffix):**
```js
"                    DATA (O.S.)"
```
*   **Match?** Yes
*   **Group 1 (Speaker):**
    ```js
    "DATA (O.S.)"
    ```

**Input 3 (Indented Speaker with 'S VOICE):**
```js
"            RIKER'S VOICE"
```
*   **Match?** Yes
*   **Group 1 (Speaker):**
    ```js
    "RIKER'S VOICE"
    ```

**Input 4 (Insufficient Indentation - No Match):**
```js
"     PICARD"
```
*   **Match?** No

**Input 5 (Lowercase Name - No Match):**
```js
"          picard"
```
*   **Match?** No

**Input 6 (Non-Speaker Line with Indentation - No Match):**
```js
"          INT. BRIDGE"
```
*   **Match?** No

**Input 7 (Movie Script Snippet Lines - Speaker Identification):**

*   **Line:**
    ```js
    "                                           SULU"
    ```
    *   **Match?** Yes
    *   **Group 1 (Speaker):**
        ```js
        "SULU"
        ```
*   **Line:**
    ```js
    "                             Leaving Section Fourteen for"
    ```
    *   **Match?** No (This is dialogue, not a speaker line format matched by this regex)
*   **Line:**
    ```js
    "                                           SAAVIK"
    ```
    *   **Match?** Yes
    *   **Group 1 (Speaker):**
        ```js
        "SAAVIK"
        ```
*   **Line:**
    ```js
    "                                           UHURA"
    ```
    *   **Match?** Yes
    *   **Group 1 (Speaker):**
        ```js
        "UHURA"
        ```
*   **Line (Descriptive text):**
    ```js
    "                   (screens and visual displays are in use): COMMANDER"
    ```
    *   **Match?** No
*   **(Other dialogue lines from the snippet will also not match this specific speaker identification regex)**

---

## 6. Dynamic Speaker Dialogue Search Pattern

*   **Purpose:** Dynamically built to search for lines attributed to a specific speaker, allowing for surrounding bracketed tags.
*   **Original Context:** `utils/grep_character_lines.py` (constructed in `get_search_config`); Used in `parser.ts` in `searchDialog`.
*   **Regex Base (Python f-string):** `rf"^\s*(?:\[.*?\]\s*)?({speaker_pattern_base})(?:\s*\[.*?\])?\s*[:(]\s*(.*)"`
    *   `speaker_pattern_base` is a variable (e.g., "PICARD", `re.escape("DR. CRUSHER")`).
*   **Node.js Equivalent (Conceptual):**
    ```javascript
    // const speakerPatternBase = "PICARD"; // Escaped if needed
    // new RegExp(`^\s*(?:\[.*?\]\s*)?(${speakerPatternBase})(?:\s*\[.*?\])?\s*[:(]\s*(.*)`);
    ```

### Explanation (Example: `speaker_pattern_base` = "PICARD")
*   `^\s*`: Line starts with optional whitespace.
*   `(?:\[.*?\]\s*)?`: Optional non-capturing group for a leading bracketed tag (e.g., `[SCENE] `).
*   `({speaker_pattern_base})`: Captures the speaker's name (Group 1).
*   `(?:\s*\[.*?\])?`: Optional non-capturing group for a trailing bracketed tag (e.g., ` [shouting]`).
*   `\s*[:(]\s*`: Whitespace, then a colon `:` or opening parenthesis `(`, then whitespace.
*   `(.*)`: Captures the dialogue (Group 2).

### Examples (Assuming `speaker_pattern_base` is "PICARD")

**Input 1:**
```js
"PICARD: Make it so."
```
*   **Match?** Yes
*   **Group 1 (Speaker):** `"PICARD"`
*   **Group 2 (Dialogue):** `"Make it so."`

**Input 2 (Leading Tag):**
```js
"  [BRIDGE] PICARD: Engage!"
```
*   **Match?** Yes
*   **Group 1 (Speaker):** `"PICARD"`
*   **Group 2 (Dialogue):** `"Engage!"`

**Input 3 (Trailing Tag):**
```js
"PICARD [to Riker]: Number One."
```
*   **Match?** Yes
*   **Group 1 (Speaker):** `"PICARD"`
*   **Group 2 (Dialogue):** `"Number One."`

**Input 4 (Parenthesis for Dialogue Start):**
```js
"  PICARD (sternly) Full power."
```
*   **Match?** Yes
*   **Group 1 (Speaker):** `"PICARD"`
*   **Group 2 (Dialogue):** `"Full power."` (Note: `(sternly)` is part of speaker match if `speaker_pattern_base` included it, or part of dialogue if regex was `PICARD` only and `(` starts dialogue section) - *This example highlights the importance of how `speaker_pattern_base` is defined and escaped.* If `speaker_pattern_base` is just `PICARD`, then `(sternly) Full power.` is Group 2. If `speaker_pattern_base` could match `PICARD (sternly)`, then `Full power.` would be Group 2, but this regex structure `[:(]` makes `(sternly)` the dialogue delimiter. For this regex, Group 1 is `PICARD`, Group 2 is `sternly) Full power.`.

**Input 5 (Different Speaker - No Match):**
```js
"[Holodeck] SOMEONE_ELSE: Not Picard."
```
*   **Match?** No

**Input 6 (Missing Colon/Parenthesis - No Match):**
```js
"PICARD without colon or paren"
```
*   **Match?** No

**Input 7 (Example with `speaker_pattern_base` as `DR\. CRUSHER`):**
```js
"  [SICKBAY] DR. CRUSHER: He's stable."
```
*   **Match?** Yes
*   **Group 1 (Speaker):** `"DR. CRUSHER"`
*   **Group 2 (Dialogue):** `"He's stable."`

---

## 7. Character Prefix Stripper

*   **Purpose:** Identifies and facilitates the removal of a character name prefix (e.g., `NAME:`, `NAME [action]::`) from a string.
*   **Original Context:** `utils/data_utils.py` (function `strip_character_prefix`); Used in `parser.ts` as `REGEX.CHARACTER_PREFIX`.
*   **Regex (Python):** `^[A-Z .'-]+(?:\s*\[[^\]]*\])?\s*[:]{1,2}\s*` (used with `re.match`)
*   **Node.js Equivalent:** `/^[A-Z .'-]+(?:\s*\[[^\]]*\])?\s*[:]{1,2}\s*/`

### Explanation
*   `^`: Start of the string.
*   `[A-Z .'-]+`: Matches the character name (uppercase letters, space, period, apostrophe, hyphen).
*   `(?:\s*\[[^\]]*\])?`: Optional non-capturing group for a bracketed stage direction (e.g., `[on comm]`). `[^\]]*` matches anything but a closing bracket.
*   `\s*[:]{1,2}\s*`: Optional whitespace, then one or two colons, then optional whitespace.
This regex is typically used to find the end of the prefix for stripping, not for capturing groups.

### Examples

**Input 1:**
```js
"PICARD: Make it so."
```
*   **Match?** Yes
*   **Matched Prefix:** `"PICARD: "`
*   **Result After Stripping:** `"Make it so."`

**Input 2 (With Bracketed Direction):**
```js
"DATA [to Geordi]: Analysis complete."
```
*   **Match?** Yes
*   **Matched Prefix:** `"DATA [to Geordi]: "`
*   **Result After Stripping:** `"Analysis complete."`

**Input 3 (Double Colon):**
```js
"WORF :: Today is a good day to die."
```
*   **Match?** Yes
*   **Matched Prefix:** `"WORF :: "`
*   **Result After Stripping:** `"Today is a good day to die."`

**Input 4 (Name with Apostrophe and Period):**
```js
"DR. PULASKI'S LOG: Entry one."
```
*   **Match?** Yes
*   **Matched Prefix:** `"DR. PULASKI'S LOG: "`
*   **Result After Stripping:** `"Entry one."`

**Input 5 (Doesn't Start with Name - No Match):**
```js
"[SCENE START] PICARD: Engage."
```
*   **Match?** No
*   **Result After Stripping:** `"[SCENE START] PICARD: Engage."` (No change)

**Input 6 (Name with Hyphen):**
```js
"GEORDI - Mission update:"
```
*   **Match?** Yes
*   **Matched Prefix:** `"GEORDI - Mission update:"`
*   **Result After Stripping:** `""` (empty string, assuming trailing space after colon is matched by `\s*`)


**Input 7 (Lowercase in Name Part - No Match by `[A-Z .'-]+`):**
```js
"Lwaxana Troi: Oh, Jean-Luc!"
```
*   **Match?** No (because "Lwaxana" contains lowercase)
*   **Result After Stripping:** `"Lwaxana Troi: Oh, Jean-Luc!"` (No change)

--- 