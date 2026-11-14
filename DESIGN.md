# SUDOKU — approved visual specification

## Tokens
- Main background #F3F6FB; board/surface #FFFFFF; peer highlight #DFE7F2; equal-digit highlight #C2D5EC; selected #9EBBDF; secondary blue #7898C0; actions/entered digits/major grid #34557F; titles and original digits #000000; minor grid #AEBED0; wrong digits #B52D38 only for errors.
- Titles Georgia, serif, normal; UI/numerals system sans-serif (-apple-system, BlinkMacSystemFont, Arial). Spanish uppercase labels, tabular numerals in timers/stats. No gradients, decorative shadows, external fonts, loud animation, sound, vibration, dark mode or navigation bar. Subtle quick transitions; honor reduced motion. Minimalism is visual only.
- Portrait-first, responsive to both viewport width and height and to iPhone safe areas, no fake phone chrome. The game board is the largest square fitting the safe available width and height after reserving the actual controls and their minimum gaps; center the board and controls together when height limits the width. Use ~18px minimum side margins, 9 equal cells, 2px outer/3×3 separators and 1px inner lines. Maintain readable contrast, touch targets ~44px when feasible (board/key row constrained by width). Avoid unnecessary scrolling; allow vertical scrolling when a readable board and accessible controls cannot fit, including enlarged text or very short viewports. Buttons typically 57px minimum height, ~11px radius.

## Home
Centered SUDOKU (no period), Georgia up to 64px. Centered decorative 3×3 grid up to 212px, thin blue lines, digits 38px, top row 5 · 3, middle · 2 ·, bottom · · 9 (dots mean blanks). Spacious layout. CONTINUAR (filled blue/white) if active; NUEVA PARTIDA (outlined if active, otherwise filled); ESTADÍSTICAS and AJUSTES plain blue. Main labels 17px; plain labels 15px. No extra content.

## Difficulty
Back chevron, NUEVA PARTIDA title (~30px). Four full-width outlined buttons (~72px high), FÁCIL / MEDIO / DIFÍCIL / EXPERTO, with 1–4 ascending blue bars. ELIGE LA DIFICULTAD. Confirm replacement before generating. Show simple progress and retry only when needed.

## Game
Use the live available viewport height, including changes to browser chrome/orientation, rather than fixed device dimensions or a portrait-only width cap. Respect all four iOS safe-area insets, with minimum 20px top, 24px bottom and 18px side padding. Measure the top information block and the actual action/keypad/footer heights, maximize the square board first, then distribute remaining vertical space between these blocks. Reduce those gaps to 4px before reducing the board; keep a readable minimum board side of min(available width, 256px) and scroll only if that minimum and the controls exceed the safe height. Labels and touch targets must not be compressed to force a fit. Board digits respond to the board's actual width (18–29px). Pause and restart states retain identical layout geometry. Do not lock or hide page overflow.

Back chevron top left, timer + pause glyph top right (~22px); difficulty label 18px left. Board below; given numbers black semibold, user numbers blue, incorrect red; digits responsive up to 29px. Highlight priority: selected > equal digit > peer > white; selection blue outline. Below board: exactly two icon+text actions (DESHACER, BORRAR) centered, icons ~29px, labels 12px or larger. Then one horizontal row of nine digit buttons, ~33px numbers / ~59px height, completed digits faded, no counters. Cell-first only; no notes or mode toggle. Footer ERRORES and REINICIAR (12px+); hide live counter if detection off. Pause overlay hides board; CONTINUAR. Restart/new game confirmations with CANCELAR. Controls use accessible Spanish labels and visible focus.

## Statistics / history
Back chevron; ESTADÍSTICAS title ~30px. Two prominent summaries RESUELTOS, TIEMPO TOTAL (values up to 46px; labels 12–14px+). Four rows by level: labels/count ~19px or larger, blue proportional bars relative to max count, RÉCORD and MEDIA ~15px (wrap rather than shrink). HISTORIAL button; history rows ~16px+ with date/level/time/errors. No fake data in production. Prefer larger typography and comfortable vertical scrolling over squeezing content.

## Completion / settings / dialogs
Centered blue check in pale-blue circle, ¡ENHORABUENA!, SUDOKU COMPLETADO, time and errors, difficulty. NUEVA PARTIDA / VOLVER AL INICIO / ESTADÍSTICAS. AJUSTES: detection toggle, EXPORTAR COPIA, IMPORTAR COPIA, BORRAR ESTADÍSTICAS. Confirm destructive actions. Dialogs: pale background, thin blue border, blue primary and outlined cancel; no unnecessary decoration.

## Icon (approved option 1)
Square light background #F3F6FB; no pre-rounded corners in exported icon (iOS masks it). Center a 3×3 thin blue #34557F grid occupying 60% of canvas (from 20% to 80%). Blue sans-serif digits centered in cells: top 5 · 3, middle · 2 ·, bottom · · 9. Digit size ~16% of canvas. No text, shadows, gradients or extra shapes. Export PNG 192, 512, 180; use local SVG source. Theme/background color #F3F6FB.
