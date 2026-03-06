import {
  superUserAuth,
  userAuth,
  isAuthValid,
  logout,
  allMaison,
  allAgent,
  addNewMaison,
  updateMaisonById,
  deleteMaisonById,
  addNewAgent,
  updateAgentById,
  deleteAgentById,
  createUser,
  getResolvedCollectionNames,
} from './backend.mjs';

const ADMIN_EMAILS = ['test@test.fr', 'admin@admin.com'];
const ADMIN_PASSWORD = 'VKoZg6mdALuk5RY';
const USER_EMAIL = 'ton.user@test.fr';
const USER_PASSWORD = '12345678';

async function test() {
  try {
    console.log('--- LISTE MAISON AVANT CONNEXION ---');
    const beforeAuth = await allMaison();
    console.log('Nombre de maisons (avant auth):', beforeAuth.length);
  } catch (e) {
    console.log('Lecture avant auth refusee (normal si regles strictes):', e.message);
  }

  try {
    console.log('--- CONNEXION ADMIN ---');
    let adminConnected = false;
    let lastAdminError = null;
    for (const email of ADMIN_EMAILS) {
      try {
        await superUserAuth(email, ADMIN_PASSWORD);
        console.log('Connecte en admin avec :', email);
        adminConnected = true;
        break;
      } catch (e) {
        lastAdminError = e;
        // On tente l'email admin suivant.
      }
    }
    if (!adminConnected) {
      const details = lastAdminError?.message ? ` Détail: ${lastAdminError.message}` : '';
      throw new Error(`Echec de connexion admin avec les identifiants fournis.${details}`);
    }
    console.log('Auth admin valide :', isAuthValid());
    const resolvedCollections = await getResolvedCollectionNames();
    console.log('Collections resolues :', resolvedCollections);
    if (!resolvedCollections.agent) {
      throw new Error(
        "Aucune collection d'agent detectee dans PocketBase. Cree une collection (ex: agent) puis relance le test.",
      );
    }

    console.log('--- AJOUT AGENT ---');
    const newAgent = {
      nom: 'Dupont',
      prenom: 'Jean',
      email: `jean.dupont.${Date.now()}@test.com`,
    };
    const createdAgent = await addNewAgent(newAgent);
    console.log('Agent ajoute :', createdAgent.id);

    console.log('--- MAJ AGENT ---');
    const updatedAgent = await updateAgentById(createdAgent.id, { prenom: 'Jeanne' });
    console.log('Agent modifie :', updatedAgent.id, updatedAgent.prenom);

    console.log('--- AJOUT MAISON ---');
    const newMaison = {
      nomMaison: `MaisonMMI-${Date.now()}`,
      prix: 250000,
      nbChambres: 4,
      nbSdb: 2,
      adresse: 'Montbeliard',
      surface: 123,
      favori: true,
      agent: createdAgent.id,
    };
    const createdMaison = await addNewMaison(newMaison);
    console.log('Maison ajoutee :', createdMaison.id);

    console.log('--- MAJ MAISON ---');
    const updatedMaison = await updateMaisonById(createdMaison.id, {
      nomMaison: 'Maison test',
      surface: 120,
      favori: true,
    });
    console.log('Maison modifiee :', updatedMaison.id, updatedMaison.nomMaison);

    console.log('--- LISTES APRES CONNEXION ADMIN ---');
    const maisons = await allMaison();
    const agents = await allAgent();
    console.log('Maisons :', maisons.length, '| Agents :', agents.length);

    console.log('--- SUPPRESSIONS ---');
    await deleteMaisonById(createdMaison.id);
    await deleteAgentById(createdAgent.id);
    console.log('Suppression maison + agent OK');

    console.log('--- CREATION USER ---');
    const newUser = {
      email: USER_EMAIL,
      password: USER_PASSWORD,
      passwordConfirm: USER_PASSWORD,
      name: 'User TP',
    };
    try {
      const user = await createUser(newUser);
      console.log('User cree :', user.id);
    } catch (userErr) {
      console.log('Creation user ignoree (deja existant ou regle):', userErr.message);
    }

    console.log('--- AUTH USER ---');
    logout();
    await userAuth(USER_EMAIL, USER_PASSWORD);
    console.log('Auth user valide :', isAuthValid());
  } catch (e) {
    console.error('Erreur pendant les tests :', e);
  } finally {
    logout();
    console.log('Deconnexion effectuee');
  }
}

test();
