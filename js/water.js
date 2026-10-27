// The 109 bodies of water used by the Water game: oceans, seas, gulfs and bays, straits and
// channels, lakes and rivers.
//
// `m` lists the Natural Earth features that make up each one, separated by "|":
//   a marine area name (seas, gulfs...), "lake:<name>" or "river:<name>".
// A sea's arms count as part of it (clicking the Adriatic counts for the Mediterranean too).
// tools/build-water.js turns these into js/data/water.js.
//
// Straits Natural Earth doesn't have (or only has as slivers) are drawn by hand: `line` lists
// [lon, lat] points along the middle of the strait (the Bering Strait sits on the map's seam,
// so it has a piece on each edge), and `area` outlines the Drake Passage. The Saint
// Lawrence is drawn the same way, since Natural Earth only has a short stub of it.
// The Southern Ocean is everything south of 60.5°S (`band`); Antarctica's land covers the rest.
(function () {
  'use strict';
  const GM = (window.GM = window.GM || {});

  GM.WATER_KINDS = [
    { id: 'ocean', name: 'Oceans and seas', kinds: ['ocean', 'sea'] },
    { id: 'gulf', name: 'Gulfs and bays', kinds: ['gulf'] },
    { id: 'strait', name: 'Straits', kinds: ['strait'] },
    { id: 'lake', name: 'Lakes', kinds: ['lake'] },
    { id: 'river', name: 'Rivers', kinds: ['river'] },
  ];

  const W = (id, name, kind, cont, m, extra) => ({
    code: 'W:' + id,
    id,
    name,
    kind,
    cont: cont ? cont.split(' ') : [],
    m: m ? m.split('|') : [],
    aka: '',
    line: null,
    ...extra,
  });

  GM.WATER = [
    // Oceans (5)
    W('atlantic', 'Atlantic Ocean', 'ocean', 'namerica samerica europe africa', 'North Atlantic Ocean|South Atlantic Ocean|Sargasso Sea'),
    W('pacific', 'Pacific Ocean', 'ocean', 'namerica samerica asia oceania', 'North Pacific Ocean|South Pacific Ocean'),
    W('indian', 'Indian Ocean', 'ocean', 'africa asia oceania', 'INDIAN OCEAN'),
    W('arctic', 'Arctic Ocean', 'ocean', 'europe asia namerica', 'Arctic Ocean'),
    W('southern', 'Southern Ocean', 'ocean', '', '', { band: [-90, -60.5] }),

    // Seas (28)
    W('mediterranean', 'Mediterranean Sea', 'sea', 'europe africa asia',
      'Mediterranean Sea|Tyrrhenian Sea|Adriatic Sea|Ionian Sea|Aegean Sea|Sea of Crete|Balearic Sea|Ligurian Sea|Alboran Sea|Golfe du Lion|Gulf of Sidra|Gulf of Gabès'),
    W('caribbean', 'Caribbean Sea', 'sea', 'namerica samerica', 'Caribbean Sea'),
    W('black', 'Black Sea', 'sea', 'europe asia', 'Black Sea'),
    W('caspian', 'Caspian Sea', 'sea', 'europe asia', 'Caspian Sea'),
    W('red', 'Red Sea', 'sea', 'africa asia', 'Red Sea|Gulf of Suez|Gulf of Aqaba'),
    W('arabian', 'Arabian Sea', 'sea', 'asia africa', 'Arabian Sea|Laccadive Sea'),
    W('north', 'North Sea', 'sea', 'europe', 'North Sea'),
    W('baltic', 'Baltic Sea', 'sea', 'europe', 'Baltic Sea|Gulf of Bothnia|Gulf of Finland|Gulf of Riga'),
    W('norwegian', 'Norwegian Sea', 'sea', 'europe', 'Norwegian Sea'),
    W('barents', 'Barents Sea', 'sea', 'europe asia', 'Barents Sea'),
    W('irish', 'Irish Sea', 'sea', 'europe', 'Irish Sea'),
    W('adriatic', 'Adriatic Sea', 'sea', 'europe', 'Adriatic Sea'),
    W('aegean', 'Aegean Sea', 'sea', 'europe asia', 'Aegean Sea|Sea of Crete'),
    W('tyrrhenian', 'Tyrrhenian Sea', 'sea', 'europe', 'Tyrrhenian Sea'),
    W('ionian', 'Ionian Sea', 'sea', 'europe', 'Ionian Sea'),
    W('bering', 'Bering Sea', 'sea', 'asia namerica', 'Bering Sea'),
    W('okhotsk', 'Sea of Okhotsk', 'sea', 'asia', 'Sea of Okhotsk'),
    W('japan', 'Sea of Japan', 'sea', 'asia', 'Sea of Japan', { aka: 'East Sea' }),
    W('eastchina', 'East China Sea', 'sea', 'asia', 'East China Sea'),
    W('yellow', 'Yellow Sea', 'sea', 'asia', 'Yellow Sea|Bo Hai'),
    W('southchina', 'South China Sea', 'sea', 'asia', 'South China Sea|Gulf of Thailand|Gulf of Tonkin'),
    W('philippine', 'Philippine Sea', 'sea', 'asia', 'Philippine Sea'),
    W('andaman', 'Andaman Sea', 'sea', 'asia', 'Andaman Sea'),
    W('coral', 'Coral Sea', 'sea', 'oceania', 'Coral Sea'),
    W('tasman', 'Tasman Sea', 'sea', 'oceania', 'Tasman Sea'),
    W('sargasso', 'Sargasso Sea', 'sea', 'namerica', 'Sargasso Sea'),
    W('weddell', 'Weddell Sea', 'sea', '', 'Weddell Sea'),
    W('ross', 'Ross Sea', 'sea', '', 'Ross Sea'),

    // Gulfs and bays (18)
    W('mexico', 'Gulf of Mexico', 'gulf', 'namerica', 'Gulf of Mexico|Bahía de Campeche'),
    W('persian', 'Persian Gulf', 'gulf', 'asia', 'Persian Gulf', { aka: 'Arabian Gulf' }),
    W('oman', 'Gulf of Oman', 'gulf', 'asia', 'Gulf of Oman'),
    W('aden', 'Gulf of Aden', 'gulf', 'africa asia', 'Gulf of Aden'),
    W('guinea', 'Gulf of Guinea', 'gulf', 'africa', 'Gulf of Guinea|Bight of Benin|Bight of Biafra'),
    W('alaska', 'Gulf of Alaska', 'gulf', 'namerica', 'Gulf of Alaska'),
    W('california', 'Gulf of California', 'gulf', 'namerica', 'Golfo de California', { aka: 'Sea of Cortez' }),
    W('thailand', 'Gulf of Thailand', 'gulf', 'asia', 'Gulf of Thailand'),
    W('bothnia', 'Gulf of Bothnia', 'gulf', 'europe', 'Gulf of Bothnia'),
    W('finland', 'Gulf of Finland', 'gulf', 'europe', 'Gulf of Finland'),
    W('carpentaria', 'Gulf of Carpentaria', 'gulf', 'oceania', 'Gulf of Carpentaria'),
    W('bight', 'Great Australian Bight', 'gulf', 'oceania', 'Great Australian Bight'),
    W('stlawrencegulf', 'Gulf of Saint Lawrence', 'gulf', 'namerica', 'Gulf of Saint Lawrence'),
    W('bengal', 'Bay of Bengal', 'gulf', 'asia', 'Bay of Bengal'),
    W('biscay', 'Bay of Biscay', 'gulf', 'europe', 'Bay of Biscay'),
    W('hudson', 'Hudson Bay', 'gulf', 'namerica', 'Hudson Bay|James Bay'),
    W('baffin', 'Baffin Bay', 'gulf', 'namerica', 'Baffin Bay'),
    W('plata', 'Río de la Plata', 'gulf', 'samerica', 'Río de la Plata', { aka: 'River Plate' }),

    // Straits and channels (20)
    W('gibraltar', 'Strait of Gibraltar', 'strait', 'europe africa', '', {
      line: [[[-6, 35.97], [-5.75, 35.95], [-5.5, 35.96], [-5.33, 36]]],
    }),
    W('bosporus', 'Bosporus', 'strait', 'europe asia', 'Bosporus'),
    W('dardanelles', 'Dardanelles', 'strait', 'europe asia', 'Dardanelles'),
    W('hormuz', 'Strait of Hormuz', 'strait', 'asia', '', {
      line: [[[55.9, 26.5], [56.25, 26.62], [56.55, 26.55], [56.75, 26.3], [56.8, 26.0]]],
    }),
    W('babelmandeb', 'Bab-el-Mandeb', 'strait', 'africa asia', '', {
      line: [[[43.15, 13], [43.3, 12.75], [43.4, 12.55], [43.55, 12.4]]],
    }),
    W('malacca', 'Strait of Malacca', 'strait', 'asia', 'Strait of Malacca|Strait of Singapore'),
    W('beringstrait', 'Bering Strait', 'strait', 'asia namerica', '', {
      line: [
        [[-168.75, 66.35], [-168.75, 65.45]],
        [[-169.4, 66.35], [-169.4, 65.65]],
      ],
    }),
    W('english', 'English Channel', 'strait', 'europe', 'English Channel'),
    W('magellan', 'Strait of Magellan', 'strait', 'samerica', 'Estrecho de Magellanes'),
    W('drake', 'Drake Passage', 'strait', 'samerica', '', {
      area: [[-68, -55.9], [-63.5, -55.3], [-56.5, -60.8], [-60, -62.2], [-64, -63.2], [-68, -61.5], [-68, -55.9]],
    }),
    W('mozambique', 'Mozambique Channel', 'strait', 'africa', 'Mozambique Channel'),
    W('taiwan', 'Taiwan Strait', 'strait', 'asia', 'Taiwan Strait'),
    W('korea', 'Korea Strait', 'strait', 'asia', 'Korea Strait'),
    W('bass', 'Bass Strait', 'strait', 'oceania', 'Bass Strait'),
    W('cook', 'Cook Strait', 'strait', 'oceania', 'Cook Strait'),
    W('torres', 'Torres Strait', 'strait', 'oceania asia', 'Torres Strait'),
    W('denmark', 'Denmark Strait', 'strait', 'europe namerica', 'Denmark Strait'),
    W('florida', 'Straits of Florida', 'strait', 'namerica', 'Straits of Florida'),
    W('messina', 'Strait of Messina', 'strait', 'europe', '', {
      line: [[[15.68, 38.27], [15.62, 38.18], [15.6, 38.06], [15.6, 37.95]]],
    }),
    W('sunda', 'Sunda Strait', 'strait', 'asia', '', {
      line: [[[105.9, -5.9], [105.55, -6.05], [105.2, -6.3], [104.9, -6.5]]],
    }),

    // Lakes (18)
    W('superior', 'Lake Superior', 'lake', 'namerica', 'lake:Lake Superior'),
    W('michigan', 'Lake Michigan', 'lake', 'namerica', 'lake:Lake Michigan'),
    W('huron', 'Lake Huron', 'lake', 'namerica', 'lake:Lake Huron'),
    W('erie', 'Lake Erie', 'lake', 'namerica', 'lake:Lake Erie'),
    W('ontario', 'Lake Ontario', 'lake', 'namerica', 'lake:Lake Ontario'),
    W('greatbear', 'Great Bear Lake', 'lake', 'namerica', 'lake:Great Bear Lake'),
    W('greatslave', 'Great Slave Lake', 'lake', 'namerica', 'lake:Great Slave Lake'),
    W('greatsalt', 'Great Salt Lake', 'lake', 'namerica', 'lake:Great Salt Lake'),
    W('nicaragua', 'Lake Nicaragua', 'lake', 'namerica', 'lake:Lago de Nicaragua'),
    W('titicaca', 'Lake Titicaca', 'lake', 'samerica', 'lake:Lago Titicaca'),
    W('maracaibo', 'Lake Maracaibo', 'lake', 'samerica', 'Lago de Maracaibo'),
    W('victoria', 'Lake Victoria', 'lake', 'africa', 'lake:Lake Victoria'),
    W('tanganyika', 'Lake Tanganyika', 'lake', 'africa', 'lake:Lake Tanganyika'),
    W('malawi', 'Lake Malawi', 'lake', 'africa', 'lake:Lake Malawi', { aka: 'Lake Nyasa' }),
    W('chad', 'Lake Chad', 'lake', 'africa', 'lake:Lake Chad'),
    W('baikal', 'Lake Baikal', 'lake', 'asia', 'lake:Lake Baikal'),
    W('aral', 'Aral Sea', 'lake', 'asia', 'lake:North Aral Sea|lake:South Aral Sea'),
    W('deadsea', 'Dead Sea', 'lake', 'asia', 'lake:Dead Sea'),

    // Rivers (20)
    W('nile', 'Nile', 'river', 'africa',
      'river:Nile|river:El Bahr el Abyad|river:Bahr el Jebel|river:Albert Nile|river:Victoria Nile|river:El Bahr el Azraq'),
    W('congo', 'Congo River', 'river', 'africa', 'river:Congo|river:Lualaba'),
    W('niger', 'Niger River', 'river', 'africa', 'river:Niger'),
    W('zambezi', 'Zambezi', 'river', 'africa', 'river:Zambezi'),
    W('amazon', 'Amazon River', 'river', 'samerica', 'river:Amazonas|river:Ucayali'),
    W('parana', 'Paraná River', 'river', 'samerica', 'river:Paraná'),
    W('mississippi', 'Mississippi River', 'river', 'namerica', 'river:Mississippi'),
    W('stlawrence', 'Saint Lawrence River', 'river', 'namerica', '', {
      line: [[[-76.35, 44.15], [-75.7, 44.5], [-74.8, 45], [-73.6, 45.45], [-72.6, 46.25], [-71.2, 46.8], [-70.5, 47.3], [-69.6, 48.1], [-68.3, 48.9], [-66.5, 49.35]]],
    }),
    W('riogrande', 'Rio Grande', 'river', 'namerica', 'river:Rio Grande'),
    W('danube', 'Danube', 'river', 'europe', 'river:Danube|river:Donau'),
    W('rhine', 'Rhine', 'river', 'europe', 'river:Rhein|river:Rhine|river:Rhin'),
    W('volga', 'Volga', 'river', 'europe', 'river:Volga'),
    W('tigris', 'Tigris', 'river', 'asia', 'river:Tigris|river:Dicle|river:Shatt al Arab'),
    W('euphrates', 'Euphrates', 'river', 'asia', 'river:Euphrates|river:Firat|river:Al Furat|river:Shatt al Arab'),
    W('indus', 'Indus', 'river', 'asia', 'river:Indus'),
    W('ganges', 'Ganges', 'river', 'asia', 'river:Ganges'),
    W('yangtze', 'Yangtze', 'river', 'asia', 'river:Chang Jiang|river:Yangtze|river:Jinsha|river:Tongtian'),
    W('yellowriver', 'Yellow River', 'river', 'asia', 'river:Huang', { aka: 'Huang He' }),
    W('mekong', 'Mekong', 'river', 'asia', 'river:Mekong|river:Lancang'),
    W('murray', 'Murray River', 'river', 'oceania', 'river:Murray'),
  ];
})();
