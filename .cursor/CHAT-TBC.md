# Next Session: Idea Factory & Screenplay Restructure

## What was agreed

The "Generate Idea" output is ONE video concept broken into 5 scenes (each ~10-15s of video). NOT 5 separate ideas to choose from.

### Idea Factory changes needed:
1. Display as **one concept card** with **5 editable scene sections** inside it
2. Each scene: editable text, delete button, individual save
3. **"Delete All & Regenerate"** — throws away the concept, generates a fresh one
4. **User feedback field** — type comments, hit regenerate to refine the same concept
5. **"Save & Approve"** button — saves the approved concept to Word doc in `assets/2. Screenplays/`, then navigates to the Screenplay step

### Screenplay (3-column table) changes needed:
1. Table format: **Scene** | **Dialogue** | **Video Prompt**
2. Each cell editable inline
3. Generated from the approved concept (AI expands scenes into the 3-column format)
4. Save as Word document

### Current state:
- The prompt already generates Scene 1-5 format (just committed)
- The display code still treats output as multiple "ideas" with emoji ratings — needs to be restructured as one concept with scene cards
- The Accept button currently goes to a finetune mode — should go to screenplay table instead
- All data auto-saves to SQLite via project metadata

### Key files:
- `components/GeneralDirection.tsx` — Idea Factory display (lines 620-880)
- `components/ConceptScreen.tsx` — orchestrates the flow, screenplay generation
- `components/IdeaFinetune.tsx` — current finetune panel (may be replaced)
- `server/videoAnalysis.js` — video/image analysis pipeline (working)
