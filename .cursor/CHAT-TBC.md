# Next Session: Restructure & Character Flow

## DONE in this session:
- Project system with SQLite DB, project creation wizard (brief→name→brand→scope)
- Light theme rebrand with TensorAx purple palette
- Dashboard: left nav, assistant on right, project name + brand in header
- Video analysis pipeline: Drive download → FFmpeg keyframes → Gemini Vision
- Image analysis for Drive folders with images
- Word doc export for Direction, Style Analysis, Approved Concept
- Single idea generation (was 5), scenes labelled Scene 1, 2, etc.
- API settings dropdown with model picker (no misspelling)
- Auto-save all user inputs to SQLite project metadata
- Removed emoji ratings and feedback input, simplified to edit/delete/accept

## What needs doing next:

### 1. Idea Factory display restructure
- Output is ONE concept with multiple scenes (not separate ideas)
- Each scene: editable inline via pencil, deletable
- Regenerate = fresh concept, Refine = same concept with user edits
- Accept saves Word doc and moves to Screenplay
- **PARTIALLY DONE** — scenes display correctly, Accept saves Word + moves to finetuning. Still needs cleanup of the old multi-idea parsing logic.

### 2. Screenplay 3-column table
- Generated from approved concept
- Table: **Scene** | **Dialogue/Voiceover** | **Video Prompt**
- Each cell editable inline
- Save as Word document
- **EXISTS** but needs polish and light theme fixes

### 3. Images screen: Character flow from screenplay
- **Fix header**: show project name + brand (currently shows old "TENSORAX STUDIO" text)
- **Add assistant sidebar** like Copy screen
- **Character checklist**: extract character names from the approved screenplay
- Show as a list: each character with status (created / not created)
- User can select from pre-existing characters in the DB or create new
- Character Builder should pre-fill with screenplay descriptions
- Created characters saved to SQLite `assets` table and linked to the project

### 4. ImagesScreen header fix
- Replace old `<h1>Tensor<span>ax</span> Studio</h1>` with `<img src="/logo-main.png">` + project name centered + API button
- Same header pattern as Copy and dashboard screens

### 5. "Save & Create Script" Drive error
- The finetuning "Save & Create Script" button tries to save to Google Drive which fails
- Should save locally to `assets/2. Screenplays/` instead (like the other save buttons)

### Key files:
- `components/GeneralDirection.tsx` — Idea Factory display
- `components/ConceptScreen.tsx` — orchestrates Copy flow, screenplay generation
- `components/IdeaFinetune.tsx` — finetuning panel
- `components/ImagesScreen.tsx` — Images/Characters screen (needs header + character flow)
- `components/CharacterBuilder.tsx` — character creation UI
- `server/videoAnalysis.js` — video/image analysis pipeline (working)
- `server/dbService.js` — SQLite backend with metadata support

### DB state:
- SQLite at `assets/tensorax.db`
- Project metadata stores: generalDirection, screenplay, conceptState
- Assets table ready for characters, scenery, clothing
- Project-asset junction table for cross-referencing
