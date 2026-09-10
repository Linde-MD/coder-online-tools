# PlantUML Gantt Studio

PlantUML Gantt Studio is a React + TypeScript + TailwindCSS single-page application for creating, editing, importing, and exporting PlantUML Gantt diagrams.

It is designed for enterprise project planning workflows and supports PlantUML features such as:

- Tasks, milestones, and phase separators
- Absolute dates and relative dependencies
- Start/end anchors, offsets, durations, and same-row milestones
- Progress percentages and PlantUML named/dual colors
- Explicit block-sequence arrows such as `[PA] -[bold]-> [SW2]`
- Header and footer time scales for yearly, quarterly, monthly, and weekly views
- Weekend closure and highlighted/closed date ranges
- Multi-line titles, headers, footers, and notes
- Import and reverse parsing of existing `.puml` files
- JSON project import/export
- SVG and PNG rendering previews
- English and Chinese UI
- Dark/light display themes
- Local browser persistence through `localStorage`

## Requirements

Install the following software before starting:

- **Node.js 18 or newer**
- **npm 9 or newer**
- A modern browser such as Microsoft Edge, Chrome, or Firefox
- Network access to the PlantUML rendering server, unless you configure a self-hosted server

Java, Graphviz, and a local PlantUML JAR are **not required** for the default setup. The application sends encoded PlantUML diagrams to the configured PlantUML HTTP server. The default server is:

```text
https://www.plantuml.com/plantuml
```

If your organization blocks the public PlantUML service, use a self-hosted PlantUML server and configure its base URL in the preview panel settings.

## Installation

Open PowerShell in the project directory:

```powershell
cd C:\Code_hub\copilot_test\gui_gantte
npm install
```

`npm install` installs React, TypeScript, Vite, TailwindCSS, Lucide icons, and the PlantUML encoder using the versions recorded in `package-lock.json`.

## CLI Commands

### Start the development server

```powershell
npm run dev
```

Vite starts the development server on port `3000` and normally opens the browser automatically:

```text
http://localhost:3000
```

If port `3000` is already in use, stop the process using it or change the port in `vite.config.ts`.

Keep this terminal running while developing. Press `Ctrl+C` to stop the server.

### Create a production build

```powershell
npm run build
```

This runs TypeScript checking and then creates the optimized production bundle in `dist/`.

### Preview the production build locally

```powershell
npm run preview
```

Vite serves the existing `dist/` build, usually at:

```text
http://localhost:4173
```

Run `npm run build` before `npm run preview` whenever source files have changed.

## First Use

1. Start the application:

   ```powershell
   npm run dev
   ```

2. Open `http://localhost:3000` if the browser does not open automatically.

3. The application loads the Linde BR1275 LLA example project by default.

4. Use the top toolbar to:
   - Switch between Chinese and English
   - Switch between dark and light display themes
   - Import an existing `.puml` file
   - View or copy generated PlantUML source
   - Open the generated diagram on the PlantUML server
   - Export a `.puml` file or project JSON

5. Use the lower editor area to manage project data:
   - **Project Nodes**: create, edit, duplicate, reorder, enable, disable, and delete nodes
   - **Explicit Arrows**: manage explicit arrows such as `-[bold]->`
   - **Project Settings**: edit title, dates, scales, calendars, headers, footers, and styles

6. Changes are rendered in the upper preview area automatically.

## Importing a PlantUML Gantt File

There are two supported import workflows.

### Import from the toolbar

1. Click **Import .puml**.
2. Paste the contents of an existing PlantUML Gantt script, or select a local `.puml`, `.plantuml`, or `.txt` file.
3. Click **Parse and Apply**.

The parser recognizes common production syntax, including:

- `@startgantt` and `@endgantt`
- `<style>` blocks and arrow settings
- Multi-line `title`, `left header`, and `right footer` blocks
- `project starts` and `printscale`
- `header printscale ...` and `footer printscale ...`
- Weekend closure rules
- Colored or closed date ranges
- Tasks, aliases, milestones, and separators
- Relative starts and ends
- Progress and color declarations
- Multi-line `note bottom` blocks
- Explicit arrow relations

### Load the built-in Linde example

Use the toolbar menu and select the built-in **Linde BR1275** example. This loads the reference project based on `BR1275_76_02_LLA.puml`.

## Creating and Editing Nodes

The node editor supports three node types:

- **Task**: a work item with dates, duration, dependencies, progress, and color
- **Milestone**: a point-in-time event using `happens`
- **Separator**: a visual phase separator using `-- Phase name --`

A task can use either absolute or relative timing.

Absolute date example:

```plantuml
[PreAnalysis] as [PA] starts 2024-08-05 and ends 2024-09-30
```

Relative timing example:

```plantuml
[SW support time reserve] as [SWr] starts at [SW2]'s end and ends 2025-04-01
```

Relative timing with an offset:

```plantuml
[On truck test in LX] starts 2 days after [LX Modification Truck]'s start and ends at [SW2]'s end
```

A disabled node remains in the project table but is emitted as a commented PlantUML line. This is useful for temporarily hiding work without deleting its history.

## Time Scales

Configure the main scale with **Printscale**. The supported values are:

- `daily`
- `weekly`
- `weekly with calendar date`
- `monthly`
- `quarterly`
- `yearly`

The application can also generate independent top and bottom time slices. For example:

```plantuml
printscale weekly
header printscale yearly
header printscale monthly
footer printscale monthly
footer printscale yearly
```

These settings are available in **Project Settings > Top and Bottom Time Slices**.

## Explicit Arrows

Use the **Explicit Arrows** tab for important visual relationships that should appear as block-sequence arrows in the diagram:

```plantuml
[PA] -[bold]-> [SW2]
```

Arrow color and thickness are configured globally in the project style settings, for example:

```plantuml
<style>
ganttDiagram {
  arrow {
    LineColor Darkred
    LineThickness 2
  }
}
</style>
```

## Exporting

The toolbar supports the following exports:

- **PlantUML source**: download the generated `.puml` script
- **Project JSON**: download configuration, nodes, and explicit arrow relations
- **SVG URL**: copy a direct PlantUML rendering URL
- **Generated source**: copy the current script to the clipboard

Project JSON can be imported again later to restore the editable project structure.

## Local Persistence

The current project is automatically saved in the browser's `localStorage` under the application storage key. Refreshing the page normally preserves the project.

Use the toolbar's empty-project or reset actions when you want to clear the current working state. Export the project as JSON before resetting if you need a backup.

Local browser storage is tied to the browser profile and origin. It is not a shared database and is not synchronized between machines or users.

## PlantUML Server Configuration

The preview panel uses the configured PlantUML HTTP server to generate SVG or PNG images. To change it:

1. Open the rendering server settings from the preview toolbar.
2. Enter the base URL of your PlantUML server.
3. Apply the setting and wait for the preview to reload.

The URL should be the server base path, without `/svg` or `/png`. For example:

```text
https://www.plantuml.com/plantuml
https://plantuml.example.com/plantuml
```

The application appends the image format and encoded diagram automatically.

## Project Structure

```text
src/
  App.tsx                         Main application state and layout
  main.tsx                        React entry point
  index.css                       Tailwind and global styles
  components/
    Header.tsx                    Toolbar, language/theme, import/export actions
    PreviewPanel.tsx              PlantUML image preview and zoom controls
    TabsHeader.tsx                Main editor tabs and add-node actions
    GlobalConfigTab.tsx           Project, calendar, style, and time-scale settings
    NodeManagementTab.tsx          Task/milestone/separator table
    RelationsTab.tsx               Explicit arrow relation editor
    ItemModal.tsx                  Node create/edit form
    ImportPumlModal.tsx             PlantUML reverse-import dialog
    PlantUMLCodeModal.tsx           Generated source viewer
  data/
    mockData.ts                    Built-in project examples
  types/
    gantt.ts                       TypeScript project and node interfaces
  utils/
    plantumlGenerator.ts           Project data to PlantUML conversion
    plantumlParser.ts              PlantUML to project data conversion
    encoder.ts                     PlantUML URL encoding and server URL creation
  i18n/
    LanguageProvider.tsx            English/Chinese language state
```

## Troubleshooting

### The preview shows a rendering error

- Check that the browser can reach the configured PlantUML server.
- Open **View Source** and inspect the generated PlantUML syntax.
- Check task aliases and dependency references.
- Check that all dates use `YYYY-MM-DD`.
- Temporarily remove recent nodes or relations to identify the invalid entry.
- Try the default public PlantUML server before testing a custom server.

### The browser does not open

Run the command and open the displayed URL manually:

```powershell
npm run dev
```

Then visit `http://localhost:3000`.

### The page appears stale after source changes

Stop and restart Vite, then refresh the browser:

```powershell
Ctrl+C
npm run dev
```

If old project data is being restored, export anything important and use the application's reset or empty-project action to clear the local state.

### TypeScript or build errors

Run:

```powershell
npm run build
```

The build command runs `tsc` before bundling. Fix TypeScript errors first, then rerun the command.

## Development Notes

- The application currently has no dedicated automated test script in `package.json`.
- Do not commit generated `dist/` output unless your deployment workflow requires it.
- Keep PlantUML syntax generation in `src/utils/plantumlGenerator.ts` and parsing in `src/utils/plantumlParser.ts` so the editor components remain focused on UI state.
