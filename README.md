# Global Minefield

Find every country on a world map with no borders, or switch to the **Water** game and find the oceans, seas, straits, lakes and rivers. No ads, no account, and it works offline.

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
| **Accuracy** | The right answer turns red and the game keeps going. Scored by accuracy. |
| **Learn** | The country turns red, then comes back a few turns later until you get it. **Show me** (`H`) reveals one you're stuck on. |

You can play any mode on:

- **World**: all 197 countries.
- **Continents**: pick one or several. The map zooms to them.
- **🔥 Hot list**: the countries you keep missing.

After a game, **Practice these in Learn mode** drills just the ones you missed.

Clicking open water doesn't count as a guess. Countries you've already found stay filled in, like on Sporcle.

## Water game

Switch the menu from **Countries** to **Water** to find 109 bodies of water:

| Kind | How many | For example |
| --- | --- | --- |
| Oceans | 5 | Atlantic, Pacific, Indian, Arctic, Southern |
| Seas | 28 | Mediterranean, Caribbean, Black, Caspian, South China, Coral |
| Gulfs and bays | 18 | Gulf of Mexico, Persian Gulf, Bay of Bengal, Hudson Bay |
| Straits and channels | 20 | Gibraltar, Bosporus, Hormuz, Malacca, English Channel, Drake Passage |
| Lakes | 18 | the Great Lakes, Victoria, Tanganyika, Baikal, Titicaca |
| Rivers | 20 | Nile, Amazon, Mississippi, Yangtze, Danube, Ganges |

- The same three modes, continents and hot list work here, with their own best scores. A body of water counts for every continent it touches; the Southern, Weddell and Ross seas are only in **World**.
- **Kinds** narrows a game to, say, just straits or just rivers. You can combine kinds, and combine them with continents.
- The map shows the whole globe, Antarctica included. Lakes are drawn as water and rivers as blue lines; the country game's map doesn't change.
- A sea's arms count as part of it: clicking the Adriatic counts for the Mediterranean, the Sargasso Sea for the Atlantic, and the Weddell Sea for the Southern Ocean. The reverse doesn't hold, so clicking the open Mediterranean doesn't count for the Adriatic.
- Clicking land doesn't count as a guess. Clicking a sea that isn't in the game (the Celebes Sea, say) tells you what it is and counts as a miss.
- Narrow straits and rivers get the same forgiving click zone as tiny countries.

## Hot list

- Any country you miss goes on the hot list.
- It comes off once you get it right on the first try in **3 separate games in a row**. Re-asks inside a Learn session don't count toward that.
- Countries you **skip** and never find before giving up count as misses.
- Click 📌 to pin a country to the list yourself, on the results screen or in **Progress & hot list**. Pinned countries stay until you unpin them.

**Progress & hot list** shows mastery by continent (or by kind, for water) and every record. It has filters and a **Practice the hot list** button. Countries and Water each have their own hot list; switch between them at the top of the screen.

## Study map

Hover or tap anywhere to see what's there, or search for a country (or body of water, in the Water game) to fly to it. **Color by my progress** paints the map by mastered, learning and hot.

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
js/map.js             drawing, zoom, and deciding what a click hit
js/storage.js         saved progress, hot lists, best scores
js/countries.js       the 197 countries and their continents
js/water.js           the 109 bodies of water, their kinds and continents
js/data/world.js      country shapes (built by tools/build-data.js)
js/data/water.js      water shapes (built by tools/build-water.js)
js/vendor/            d3 v7.9.0 and topojson-client v3.1.0
```

To rebuild the map data:

- **Countries:** download world-atlas's `countries-50m.json` and `countries-10m.json`, then run `node tools/build-data.js countries-50m.json countries-10m.json`.
- **Water:** download Natural Earth v5.1.2's `ne_10m_geography_marine_polys`, `ne_50m_lakes` and `ne_50m_rivers_lake_centerlines` GeoJSON files into one folder, then run `node tools/build-water.js <that folder>`.

## Credits

- Country shapes are from [Natural Earth](https://www.naturalearthdata.com/) (public domain), via [world-atlas](https://github.com/topojson/world-atlas) 2.0.2 (50m), with Tuvalu taken from the 10m file.
- Seas, lakes and rivers are from Natural Earth v5.1.2 (public domain). A few it lacks or has only as slivers are drawn by hand: the straits of Hormuz, Gibraltar, Messina and Sunda, the Bering Strait, Bab-el-Mandeb, the Drake Passage and the Saint Lawrence River. The Southern Ocean is everything south of 60.5°S.
- Drawing uses [d3](https://d3js.org) and [topojson-client](https://github.com/topojson/topojson-client).

## License

The game's code is [MIT](LICENSE). The bundled libraries and map data keep their own licenses (ISC and public domain); see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
