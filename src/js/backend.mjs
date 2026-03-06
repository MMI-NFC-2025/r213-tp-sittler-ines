import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');
const MAISON_COLLECTIONS = ['maison', 'Maison', 'maisons', 'Maisons'];
const AGENT_COLLECTIONS = ['agent', 'Agent', 'agents', 'Agents'];
const USER_COLLECTIONS = ['users', 'user', 'Users', 'User'];
const resolvedCollectionCache = {};

function isInvalidCollectionError(error) {
  return (
    error?.status === 404 &&
    String(error?.response?.message ?? '').toLowerCase().includes('collection context')
  );
}

async function collectionExists(collectionName) {
  try {
    await pb.collection(collectionName).getList(1, 1);
    return true;
  } catch (error) {
    if (isInvalidCollectionError(error)) {
      return false;
    }
    // 401/403 ou autre: la collection existe probablement mais l'acces est restreint.
    return true;
  }
}

async function discoverCollectionByKeyword(keywords) {
  try {
    const collections = await pb.collections.getFullList({ fields: 'name' });
    const allNames = collections.map((collection) => collection.name);
    const loweredKeywords = keywords.map((keyword) => keyword.toLowerCase());
    return (
      allNames.find((name) =>
        loweredKeywords.some((keyword) => name.toLowerCase().includes(keyword)),
      ) ?? null
    );
  } catch (_error) {
    return null;
  }
}

async function resolveCollectionName(cacheKey, candidates, keywords) {
  if (resolvedCollectionCache[cacheKey]) {
    return resolvedCollectionCache[cacheKey];
  }

  for (const candidate of candidates) {
    if (await collectionExists(candidate)) {
      resolvedCollectionCache[cacheKey] = candidate;
      return candidate;
    }
  }

  const discoveredName = await discoverCollectionByKeyword(keywords);
  if (discoveredName) {
    resolvedCollectionCache[cacheKey] = discoveredName;
    return discoveredName;
  }

  throw new Error(`Collection introuvable pour ${cacheKey}.`);
}

async function tryResolveCollectionName(cacheKey, candidates, keywords) {
  try {
    return await resolveCollectionName(cacheKey, candidates, keywords);
  } catch (_error) {
    return null;
  }
}

async function withResolvedCollection(cacheKey, candidates, keywords, operation) {
  const collectionName = await resolveCollectionName(cacheKey, candidates, keywords);
  return await operation(collectionName);
}

// -------- AUTH --------

export async function superUserAuth(login, mdp) {
  try {
    return await pb.collection('_superusers').authWithPassword(login, mdp);
  } catch (_firstError) {
    // Fallback utile selon la version/config PocketBase.
    return await pb.collection('superusers').authWithPassword(login, mdp);
  }
}

export async function userAuth(login, mdp) {
  return await withResolvedCollection('user', USER_COLLECTIONS, ['user'], async (collectionName) => {
    return await pb.collection(collectionName).authWithPassword(login, mdp);
  });
}

export function isAuthValid() {
  return pb.authStore.isValid;
}

export function logout() {
  pb.authStore.clear();
}

// -------- MAISON --------

export async function addNewMaison(newMaison) {
  return await withResolvedCollection(
    'maison',
    MAISON_COLLECTIONS,
    ['maison', 'house'],
    async (collectionName) => {
    return await pb.collection(collectionName).create(newMaison);
    },
  );
}

export async function deleteMaisonById(id) {
  return await withResolvedCollection(
    'maison',
    MAISON_COLLECTIONS,
    ['maison', 'house'],
    async (collectionName) => {
    return await pb.collection(collectionName).delete(id);
    },
  );
}

export async function updateMaisonById(id, data) {
  return await withResolvedCollection(
    'maison',
    MAISON_COLLECTIONS,
    ['maison', 'house'],
    async (collectionName) => {
    return await pb.collection(collectionName).update(id, data);
    },
  );
}

export async function allMaison() {
  return await withResolvedCollection(
    'maison',
    MAISON_COLLECTIONS,
    ['maison', 'house'],
    async (collectionName) => {
    return await pb.collection(collectionName).getFullList({ sort: '-created' });
    },
  );
}

// -------- AGENT --------

export async function addNewAgent(newAgent) {
  return await withResolvedCollection(
    'agent',
    AGENT_COLLECTIONS,
    ['agent'],
    async (collectionName) => {
    return await pb.collection(collectionName).create(newAgent);
    },
  );
}

export async function deleteAgentById(id) {
  return await withResolvedCollection(
    'agent',
    AGENT_COLLECTIONS,
    ['agent'],
    async (collectionName) => {
    return await pb.collection(collectionName).delete(id);
    },
  );
}

export async function updateAgentById(id, data) {
  return await withResolvedCollection(
    'agent',
    AGENT_COLLECTIONS,
    ['agent'],
    async (collectionName) => {
    return await pb.collection(collectionName).update(id, data);
    },
  );
}

export async function allAgent() {
  return await withResolvedCollection(
    'agent',
    AGENT_COLLECTIONS,
    ['agent'],
    async (collectionName) => {
    return await pb.collection(collectionName).getFullList({ sort: '-created' });
    },
  );
}

// -------- USER --------

export async function createUser(user) {
  return await withResolvedCollection('user', USER_COLLECTIONS, ['user'], async (collectionName) => {
    return await pb.collection(collectionName).create(user);
  });
}

// -------- FONCTIONS UTILISEES PAR LES PAGES ASTRO --------

export async function getOffres() {
  try {
    return await allMaison();
  } catch (error) {
    console.log('Une erreur est survenue en lisant la liste des maisons', error);
    return [];
  }
}

export async function getResolvedCollectionNames() {
  const maison = await tryResolveCollectionName('maison', MAISON_COLLECTIONS, ['maison', 'house']);
  const agent = await tryResolveCollectionName('agent', AGENT_COLLECTIONS, ['agent']);
  const user = await tryResolveCollectionName('user', USER_COLLECTIONS, ['user']);
  return { maison, agent, user };
}

export async function getOffre(id) {
  try {
    return await withResolvedCollection(
      'maison',
      MAISON_COLLECTIONS,
      ['maison', 'house'],
      async (collectionName) => {
      return await pb.collection(collectionName).getOne(id);
      },
    );
  } catch (error) {
    console.log('Une erreur est survenue en lisant la maison', error);
    return null;
  }
}

export async function getImageUrl(record, recordImage) {
  return pb.files.getURL(record, recordImage);
}

export async function addOffre(house) {
  try {
    await addNewMaison(house);
    return {
      success: true,
      message: 'Offre ajoutee avec succes',
    };
  } catch (error) {
    console.log('Une erreur est survenue en ajoutant la maison', error);
    return {
      success: false,
      message: 'Une erreur est survenue en ajoutant la maison',
    };
  }
}

export async function filterByPrix(minPrix, maxPrix) {
  const offres = await getOffres();
  return offres.filter((offre) => {
    const prix = Number(offre.prix ?? offre.Prix);
    return prix >= minPrix && prix <= maxPrix;
  });
}

function offreBelongsToAgent(offre, agentId) {
  const relationFields = ['agent', 'Agent', 'agentId', 'agent_id', 'id_agent'];

  for (const field of relationFields) {
    const value = offre?.[field];
    if (Array.isArray(value) && value.includes(agentId)) {
      return true;
    }
    if (value === agentId) {
      return true;
    }
  }

  return false;
}

export async function getAgents() {
  try {
    return await allAgent();
  } catch (error) {
    console.log('Une erreur est survenue en lisant la liste des agents', error);
    return [];
  }
}

export async function getAgent(id) {
  try {
    return await withResolvedCollection(
      'agent',
      AGENT_COLLECTIONS,
      ['agent'],
      async (collectionName) => {
      return await pb.collection(collectionName).getOne(id);
      },
    );
  } catch (error) {
    console.log("Une erreur est survenue en lisant l'agent", error);
    return null;
  }
}

export async function getOffresByAgent(agentId) {
  const agent = await getAgent(agentId);
  const offres = await getOffres();

  const linkedOffres = agent?.liens ?? agent?.Liens;
  if (Array.isArray(linkedOffres) && linkedOffres.length > 0) {
    return offres.filter((offre) => linkedOffres.includes(offre.id));
  }

  return offres.filter((offre) => offreBelongsToAgent(offre, agentId));
}

export async function setFavori(house) {
  const currentFavori = house?.favori ?? house?.Favori ?? false;
  const favoriField = Object.prototype.hasOwnProperty.call(house ?? {}, 'favori')
    ? 'favori'
    : 'Favori';
  return await updateMaisonById(house.id, { [favoriField]: !currentFavori });
}
