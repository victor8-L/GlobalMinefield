# Global Minefield

Find every country on a world map with no borders. No ads, no account, and it works offline.

## Play

Download the code and open **`index.html`** in any modern browser. No install or build step is needed:

```bash
git clone https://github.com/victor8-L/GlobalMinefield.git
open GlobalMinefield/index.html
```

## Modes

| Mode | Wrong click |
| --- | --- |
| **Minefield** | Ends the game. Your score is how many you found, and your best is saved. |
| **Accuracy** | The real country turns red and the game keeps going. Scored by accuracy. |
| **Learn** | The country turns red, then comes back a few turns later until you get it. **Show me** (`H`) reveals one you're stuck on. |

You can play any mode on:

- **World**: all 197 countries.
- **Continents**: pick one or several. The map zooms to them.
- **🔥 Hot list**: the countries you keep missing.

After a game, **Practice these in Learn mode** drills just the ones you missed.

Clicking open water doesn't count as a guess. Countries you've already found stay filled in, like on Sporcle.

## Hot list

- Any country you miss goes on the hot list.
- It comes off once you get it right on the first try in **3 separate games in a row**. Re-asks inside a Learn session don't count toward that.
- Countries you **skip** and never find before giving up count as misses.
- Click 📌 to pin a country to the list yourself, on the results screen or in **Progress & hot list**. Pinned countries stay until you unpin them.

**Progress & hot list** shows mastery by continent and every country's record. It has filters and a **Practice the hot list** button.

## Study map

Hover or tap anywhere to see what's there, or search for a country to fly to it. **Color by my progress** paints the map by mastered, learning and hot.

## Controls

| Action | How |
| --- | --- |
| Zoom | Scroll, pinch, `+` / `-`, or the buttons |
| Pan | Drag |
| Reset view | `0` or ⌂ |
| Skip | `Space` (sends the country to the back of the line) |
| Show me (Learn) | `H` |

## Tiny countries

Tiny countries have no markers, so the map stays truly "no outlines". Small islands show up as specks of land. When a country is too small to click at your current zoom (Vatican City, Tuvalu, Grenada…), it accepts clicks within a few pixels of it. If two tiny ones are close together, the nearer one wins. Zoom in to be precise. Clicks in the water just off a coast count for the country you're looking for.

## Saving progress

Progress is saved in the browser you play in, and each browser keeps its own record. Clearing site data or using a private window loses it. Use **Export progress** in **Progress & hot list** to save a backup file, and **Import progress** to restore it or move it somewhere else.

## Country list

The country list is the same 197 Sporcle uses: the 193 UN members plus Vatican City, Palestine, Kosovo and Taiwan.

- Pieces that belong to a country count as that country: N. Cyprus for Cyprus, Somaliland for Somalia, Hong Kong and Macao for China, Åland for Finland, and France's overseas departments for France.
- Territories like Greenland, Puerto Rico and Western Sahara are on the map but aren't countries in the game. Clicking one tells you what it is.

## Files

```
index.html            the game; open this
css/style.css
js/app.js             menus, game loop, results, progress screen, study map
js/game.js            rules for Minefield / Accuracy / Learn
js/map.js             drawing, zoom, and deciding which country a click hit
js/storage.js         saved progress, hot list, best scores
js/countries.js       the 197 countries and their continents
js/data/world.js      map shapes (built by tools/build-data.js)
js/vendor/            d3 v7.9.0 and topojson-client v3.1.0
```

To rebuild the map data, download world-atlas's `countries-50m.json` and `countries-10m.json`, then run `node tools/build-data.js countries-50m.json countries-10m.json`.

## Credits

- Map shapes are from [Natural Earth](https://www.naturalearthdata.com/) (public domain), via [world-atlas](https://github.com/topojson/world-atlas) 2.0.2 (50m), with Tuvalu taken from the 10m file.
- Drawing uses [d3](https://d3js.org) and [topojson-client](https://github.com/topojson/topojson-client).

## License

The game's code is [MIT](LICENSE). The bundled libraries and map data keep their own licenses (ISC and public domain); see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
