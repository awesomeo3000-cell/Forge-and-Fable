# Portrait drop folder

Drop `.png`, `.jpg`, `.jpeg`, or `.webp` artwork anywhere in this folder, then run:

```powershell
npm run portraits:sync
```

The command creates optimized 512×512 copies in `public/portraits/drop-ins/` and refreshes the portrait selector catalog. Restarting the site is not normally necessary while the development server is running.

## Suggested portraits

To associate artwork with a species, either:

- Begin the filename with the species: `tiefling-purple-warlock.png`
- Put it in a species folder: `tiefling/purple-warlock.png`

Recognized species are aasimar, dragonborn, dwarf, elf, genasi, gnome, goliath, half-elf, halfling, human, orc, and tiefling. Other filenames still appear under **All Portraits**.

You can replace an image while keeping the same filename and rerun the command. Its saved portrait ID stays the same, so existing characters continue to use it.
