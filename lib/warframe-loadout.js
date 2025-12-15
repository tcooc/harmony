// remember to run `npx playwright install chromium`
const { chromium } = require('playwright');
var { db } = require('../db');
var { logger } = require('../logger');
var { hash } = require('./hash');

const TWITCH_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko'; // twitch's global client id
const TWITCH_GQL = 'https://gql.twitch.tv/gql';
const LOADOUT_API =
  'https://api.warframe.com/cdn/twitch/getActiveLoadout.php?account=';
const OVERFRAME_URL = 'https://overframe.gg/players/';

const fetchJwt = async () => {
  const { settings } = await db.get();
  if (settings.twitch.referenceChannelToken) {
    const exp =
      JSON.parse(atob(settings.twitch.referenceChannelToken.split('.')[1]))
        .exp * 1000;
    if (Date.now() < exp) {
      return settings.twitch.referenceChannelToken;
    }
  }

  const response = await fetch(TWITCH_GQL, {
    method: 'POST',
    headers: {
      'client-id': TWITCH_CLIENT_ID
    },
    body: JSON.stringify([
      {
        operationName: 'ExtensionsForChannel',
        variables: {
          channelID: settings.twitch.referenceChannelId
        },
        extensions: {
          persistedQuery: {
            version: 1,
            sha256Hash:
              'd52085e5b03d1fc3534aa49de8f5128b2ee0f4e700f79bf3875dcb1c90947ac3'
          }
        }
      }
    ])
  });
  const data = await response.json();
  const token = data[0]?.data?.user?.channel?.selfInstalledExtensions?.find(
    (extension) => extension.installation.extension.name === 'Warframe Arsenal'
  )?.token?.jwt;

  await db.update(({ settings }) => {
    settings.twitch.referenceChannelToken = token;
  });

  return token;
};

// {playerName, items[{..., type}]}
const fetchLoadout = async (name) => {
  const token = await fetchJwt();
  const response = await fetch(`${LOADOUT_API}${encodeURIComponent(name)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  logger.info(`Fetching loadout for ${name}, got status ${response.status}`);
  if (response.status == 200) {
    const data = await response.json();
    // convert to more usable format
    const mapData = (item, type) =>
      item
        ? { ...item, type, hash: hash([item.abilityOverride, item.upgrades]) }
        : item;
    return {
      playerName: data.accountInfo.playerName,
      items: [
        mapData(data.loadOuts.NORMAL.warframe, 'warframe'),
        mapData(data.loadOuts.NORMAL.primary, 'primary'),
        mapData(data.loadOuts.NORMAL.secondary, 'secondary'),
        mapData(data.loadOuts.NORMAL.melee, 'melee'),
        mapData(data.loadOuts.SENTINEL.companion, 'companion'),
        mapData(data.loadOuts.SENTINEL.roboticweapon, 'roboticweapon')
      ].filter((item) => item)
    };
  }
};

// [{itemName, uniqueName, href}]
const fetchOverframe = async (name) => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${OVERFRAME_URL}${encodeURIComponent(name)}/pc/`);

  const items = await page.evaluate(() => {
    return Array.prototype.map.call(
      document.querySelectorAll('a[aria-label]'),
      (el) => {
        const itemName = (
          el.ariaLabel.charCodeAt(0) >= 0xe000
            ? el.ariaLabel.substring(1)
            : el.ariaLabel
        ).trim();
        const uniqueName =
          el.parentElement[
            Object.keys(el.parentElement).filter((key) =>
              key.includes('__reactFiber')
            )[0]
          ]?.return?.memoizedProps?.itemData?.uniqueName;
        const href = el.href;
        return { itemName, uniqueName, href };
      }
    );
  });
  await browser.close();

  return items;
};

const needsUpdate = async (name, loadout) => {
  const { warframeLoadoutPlayers } = await db.get();
  const existingItems = warframeLoadoutPlayers?.[name]?.items;
  if (!existingItems) {
    return true;
  }
  for (let i = 0; i < loadout.items.length; i++) {
    const item = loadout.items[i];
    if (
      !existingItems.find(
        ({ uniqueName, hash }) =>
          uniqueName === item.uniqueName && hash === item.hash
      )
    ) {
      return true;
    }
  }
  return false;
};

const updateDatabase = async (name, loadout, builds) => {
  await db.update((data) => {
    // warframeLoadoutData is uniqueName -> itemName, type
    if (!data.warframeLoadoutData) {
      data.warframeLoadoutData = {};
    }
    for (let i = 0; i < loadout.items.length; i++) {
      const item = loadout.items[i];
      const build = builds.find(
        ({ uniqueName }) => uniqueName === item.uniqueName
      );
      if (!build) {
        logger.error(`Could not find build for ${item.uniqueName}`);
        continue;
      }
      if (!data.warframeLoadoutData[item.uniqueName]) {
        data.warframeLoadoutData[item.uniqueName] = {
          name: build.itemName,
          type: item.type
        };
      }
    }

    // warframeLoadoutPlayers is playerName -> items[] -> uniqueName, href, hash
    if (!data.warframeLoadoutPlayers) {
      data.warframeLoadoutPlayers = {};
    }
    if (!data.warframeLoadoutPlayers[name]) {
      data.warframeLoadoutPlayers[name] = {};
    }
    if (!data.warframeLoadoutPlayers[name].items) {
      data.warframeLoadoutPlayers[name].items = [];
    }
    const items = data.warframeLoadoutPlayers[name].items;
    data.warframeLoadoutPlayers[name].playerName = loadout.playerName;
    for (let i = 0; i < builds.length; i++) {
      const build = builds[i];
      const item = loadout.items.find(
        ({ uniqueName }) => uniqueName === build.uniqueName
      );
      if (!item) {
        continue;
      }
      const index = data.warframeLoadoutPlayers[name].items.findIndex(
        ({ uniqueName }) => uniqueName === build.uniqueName
      );
      const newItem = {
        uniqueName: item.uniqueName,
        href: build.href,
        hash: item.hash
      };
      if (index === -1) {
        items.push(newItem);
      } else {
        items[index] = newItem;
      }
    }
  });
};

const updateLoadout = async (player) => {
  const name = player.toLowerCase();

  // fetch loadout using warframe API
  const loadout = await fetchLoadout(name);
  if (!loadout) {
    return;
  }

  // check if update is needed
  const shouldUpdate = await needsUpdate(name, loadout);
  if (!shouldUpdate) {
    logger.info(`no update needed for ${name}, skipping`);
    return;
  }

  const builds = await fetchOverframe(name);

  await updateDatabase(name, loadout, builds);
};

const bindServer = (channelsStatus) => (app) => {
  app.get('/', (req, res) => {
    res.send(
      'Usage (replace <baseurl> with url of this page): $(urlfetch <baseurl>/$(channel)/search?q=$(querystring))'
    );
  });

  app.get('/:name/search', async (req, res) => {
    const name = req.params.name;
    const query = req.query.query?.toLowerCase();
    if (!name || !query) {
      res.end('Missing query');
      return;
    }

    const { warframeLoadoutData, warframeLoadoutPlayers } = await db.get();

    const player = warframeLoadoutPlayers[name];
    if (!player) {
      res.end('No data on player');
    }

    const matches = new Set();
    for (const [uniqueName, item] of Object.entries(warframeLoadoutData)) {
      if (item.name.toLowerCase().indexOf(query) > -1) {
        matches.add(uniqueName);
      }
    }

    const match = player.items.find(({ uniqueName }) =>
      matches.has(uniqueName)
    );

    if (match) {
      res.end(`${item.name} build: ${match.href}`);
    } else {
      res.end('No item found matching query');
    }
  });

  // registered channels
  app.get('/_internal/listen', async (req, res) => {
    const all = typeof req.query.all !== 'undefined';

    const igns = new Set();
    const { twitch } = await db.get();
    twitch.forEach(({ stream, ign }) => {
      // check if channel is online
      if ((typeof channelsStatus[stream] === 'string' || all) && ign) {
        igns.add(ign);
      }
    });
    res.json(Array.from(igns));
  });

  app.post('/_internal/update', async (req, res) => {
    const { settings } = await db.get();
    if (req.get('Authorization') !== settings.twitch.client_secret) {
      res.status(403).end();
      return;
    }
    const { name, loadout, builds } = req.body;
    if (!name || !loadout) {
      res.status(400).end();
      return;
    }
    if (!builds) {
      res.json(await needsUpdate(name, loadout));
      return;
    }
    await updateDatabase(name, loadout, builds);
    res.end();
  });
};

module.exports = {
  fetchLoadout,
  fetchOverframe,
  updateLoadout,
  bindServer
};
