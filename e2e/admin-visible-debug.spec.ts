import { test, expect } from '@playwright/test';

const pauseMs = 2500;
const today = new Date().toISOString().split('T')[0];

async function pauseForViewer(page) {
  await page.waitForTimeout(pauseMs);
}

async function installRedCursor(page) {
  await page.addInitScript(() => {
    const createCursor = () => {
      if (document.getElementById('playwright-red-cursor')) return;

      const cursor = document.createElement('div');
      cursor.id = 'playwright-red-cursor';
      cursor.style.position = 'fixed';
      cursor.style.left = '24px';
      cursor.style.top = '24px';
      cursor.style.width = '28px';
      cursor.style.height = '28px';
      cursor.style.borderRadius = '999px';
      cursor.style.background = '#ff0000';
      cursor.style.border = '4px solid #ffffff';
      cursor.style.boxShadow = '0 0 0 4px rgba(255, 0, 0, 0.35), 0 8px 18px rgba(0, 0, 0, 0.35)';
      cursor.style.transform = 'translate(-50%, -50%)';
      cursor.style.pointerEvents = 'none';
      cursor.style.zIndex = '2147483647';
      cursor.style.transition = 'left 120ms linear, top 120ms linear, transform 120ms ease';
      document.body.appendChild(cursor);

      (window as any).__movePlaywrightRedCursor = (x, y) => {
        cursor.style.left = `${x}px`;
        cursor.style.top = `${y}px`;
      };

      (window as any).__pressPlaywrightRedCursor = () => {
        cursor.style.transform = 'translate(-50%, -50%) scale(0.72)';
      };

      (window as any).__releasePlaywrightRedCursor = () => {
        cursor.style.transform = 'translate(-50%, -50%) scale(1)';
      };
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createCursor);
    } else {
      createCursor();
    }
  });
}

async function moveRedCursorTo(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error('Impossible de placer le curseur rouge sur l’élément demandé.');
  await page.evaluate(({ x, y }) => {
    (window as any).__movePlaywrightRedCursor?.(x, y);
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
}

async function clickWithRedCursor(page, locator) {
  await moveRedCursorTo(page, locator);
  await page.evaluate(() => (window as any).__pressPlaywrightRedCursor?.());
  await locator.click();
  await page.evaluate(() => (window as any).__releasePlaywrightRedCursor?.());
  await pauseForViewer(page);
}

async function fillWithRedCursor(page, locator, value) {
  await moveRedCursorTo(page, locator);
  await locator.fill(value);
  await pauseForViewer(page);
}

async function selectWithRedCursor(page, locator, value) {
  await moveRedCursorTo(page, locator);
  await locator.selectOption(value);
  await pauseForViewer(page);
}

test.describe('Démonstration visible - administration vélo', () => {
  test.setTimeout(180000);

  test.beforeEach(async ({ page }) => {
    await installRedCursor(page);

    await page.route('**/src/api/entraAuth.js*', async (route) => {
      await route.fulfill({
        contentType: 'application/javascript',
        body: `
          export async function initializeEntraSession() { return 'playwright-admin-id-token'; }
          export async function signInWithEntra() { return null; }
          export async function signOutWithEntra() { return null; }
        `,
      });
    });

    await page.route('**/src/api/bikeflowApi.js*', async (route) => {
      await route.fulfill({
        contentType: 'application/javascript',
        body: `
          let nextBikeId = 10;
          let nextReparationId = 2;
          let bikes = [
            { bike_id: 1, bike_name: 'Vélo admin témoin', bike_code: 'ADM-001', bike_description: 'cadre en trapèze', bike_size: 'M', is_available: true },
            { bike_id: 2, bike_name: 'Vélo réservé témoin', bike_code: 'ADM-002', bike_description: 'cadre en col de cygne', bike_size: 'S', is_available: true },
          ];
          let reservations = [
            { reservation_id: 1, reservation_code: 'ADM-RES-001', bike_id: 2, user_id: 2, reservation_date: '${today}T09:00:00', return_date: '${today}T10:00:00' },
          ];
          let reparations = [
            { reparation_id: 1, bike_id: 1, reparation_description: 'Contrôle freins témoin', reparation_begin_date: '${today}T08:00:00', reparation_end_date: null, reparation_cost: null },
          ];
          const returns = [
            { return_id: 1, reservation_id: 4, reservation_code: 'RET-001', bike_id: 1, bike_name: 'Vélo admin témoin', return_date: '${today}T11:00:00', return_state: 'ok', problem_state: 'Aucun', return_comment: 'Retour témoin sans anomalie' },
          ];
          const users = [
            { user_id: 1, user_name: 'Admin Démo' },
            { user_id: 2, user_name: 'Utilisateur Test' },
          ];

          export function setAuthToken() {}
          export async function loginEntra() {
            return {
              user_id: 1,
              user_name: 'Admin Démo',
              user_email: 'admin.demo@example.test',
              role_name: 'Administrateur',
              is_admin: true,
            };
          }
          export async function fetchBikes() { return bikes; }
          export async function fetchUsers() { return users; }
          export async function fetchReservations() { return reservations; }
          export async function fetchReturns() { return returns; }
          export async function fetchMyStats() { return { total_reservations: 0, total_km: 0, returned_reservations: 0, unique_bikes: 0, favorite_bike: null, active_reservations: 0 }; }
          export async function fetchReservation(id) { return reservations.find((item) => item.reservation_id === Number(id)); }
          export async function createReservation(data) { return data; }
          export async function cancelReservation(id) {
            reservations = reservations.filter((item) => item.reservation_id !== Number(id));
            return {};
          }
          export async function fetchReparations() { return reparations; }
          export async function createReparation(data) {
            const reparation = { reparation_id: nextReparationId++, bike_id: data.bike_id, reparation_description: data.reparation_description, reparation_begin_date: '${today}T12:00:00', reparation_end_date: null, reparation_cost: null };
            reparations = [...reparations, reparation];
            return reparation;
          }
          export async function closeReparation(id, data) {
            reparations = reparations.map((item) => item.reparation_id === Number(id) ? { ...item, ...data } : item);
            return reparations.find((item) => item.reparation_id === Number(id));
          }
          export async function createBike(data) {
            const quantity = Number(data.bike_quantity || 1);
            const created = [];
            for (let index = 0; index < quantity; index += 1) {
              const suffix = quantity > 1 ? '-' + String(index + 1).padStart(2, '0') : '';
              const bike = {
                bike_id: nextBikeId++,
                bike_name: quantity > 1 ? data.bike_name + ' ' + (index + 1) : data.bike_name,
                bike_code: data.bike_code + suffix,
                bike_size: data.bike_size,
                bike_description: data.bike_description,
                is_available: true,
              };
              bikes = [...bikes, bike];
              created.push(bike);
            }
            return quantity === 1 ? created[0] : created;
          }
          export async function updateBike(id, data) {
            bikes = bikes.map((bike) => bike.bike_id === Number(id) ? { ...bike, ...data } : bike);
            return bikes.find((bike) => bike.bike_id === Number(id));
          }
          export async function deleteBike(id) {
            bikes = bikes.filter((bike) => bike.bike_id !== Number(id));
            return {};
          }
          export async function fetchReturn(reservationId) { return returns.find((item) => item.reservation_id === Number(reservationId)) || null; }
          export async function createReturn() { return {}; }
          export async function createReturnWithPhotos() { return {}; }
        `,
      });
    });
  });

  test('tester les fonctions admin dans une copie mockée', async ({ page }) => {
    const bikeName = `Vélo démo admin ${Math.floor(Math.random() * 900 + 100)}`;
    const bikeCode = `ADM-DEMO-${Math.floor(Math.random() * 900 + 100)}`;

    await test.step('ouvrir la copie admin', async () => {
      await page.goto('/');
      await expect(page.getByText('Admin Démo - Administrateur')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
      await moveRedCursorTo(page, page.getByRole('heading', { name: 'Administration' }));
      await pauseForViewer(page);
    });

    await test.step('observer le tableau de bord admin', async () => {
      await moveRedCursorTo(page, page.getByText('Quantité totale dans la flotte.'));
      await pauseForViewer(page);
    });

    await test.step('ouvrir la page réservations depuis la navigation', async () => {
      await clickWithRedCursor(page, page.locator('nav').getByRole('button', { name: 'Réservations' }));
      await expect(page.getByRole('heading', { name: 'Vélos disponibles' })).toBeVisible();
    });

    await test.step('revenir à l’administration', async () => {
      await clickWithRedCursor(page, page.locator('nav').getByRole('button', { name: 'Administration' }));
      await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
    });

    await test.step('ajouter un vélo dans la copie admin', async () => {
      const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Ajouter un vélo' }) });
      await fillWithRedCursor(page, section.getByPlaceholder('Nom du vélo *'), bikeName);
      await fillWithRedCursor(page, section.getByPlaceholder('Code de base (ex: VL-042) *'), bikeCode);
      await fillWithRedCursor(page, section.getByPlaceholder('Quantité *'), '1');
      await selectWithRedCursor(page, section.getByRole('combobox'), 'L');
      await fillWithRedCursor(page, section.getByPlaceholder('Description (facultative)'), 'cadre en trapèze - test admin');
      await clickWithRedCursor(page, section.getByRole('button', { name: 'Ajouter le vélo' }));
      await expect(page.locator('tr').filter({ hasText: bikeCode })).toBeVisible();
    });

    await test.step('modifier le vélo ajouté', async () => {
      const row = page.locator('tr').filter({ hasText: bikeCode });
      await clickWithRedCursor(page, row.getByRole('button', { name: 'Modifier' }));
      const editForm = page.locator('form').filter({ hasText: `Modifier ${bikeName}` });
      await fillWithRedCursor(page, editForm.getByPlaceholder('Description / type de cadre'), 'cadre en col de cygne - modifié');
      await clickWithRedCursor(page, editForm.getByRole('button', { name: 'Enregistrer' }));
      await expect(page.locator('tr').filter({ hasText: bikeCode }).getByText('cadre en col de cygne - modifié')).toBeVisible();
    });

    await test.step('créer une réparation pour le vélo ajouté', async () => {
      const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Nouvelle réparation' }) });
      const createdRow = page.locator('tr').filter({ hasText: bikeCode });
      await expect(createdRow).toBeVisible();
      const bikeId = await createdRow.evaluate((row) => row.getAttribute('data-bike-id'));
      await selectWithRedCursor(page, section.getByRole('combobox'), bikeId || '10');
      await fillWithRedCursor(page, section.getByPlaceholder('Description de la réparation'), 'Contrôle chaîne test admin');
      await clickWithRedCursor(page, section.getByRole('button', { name: 'Créer la réparation' }));
      await expect(page.getByText('Contrôle chaîne test admin')).toBeVisible();
    });

    await test.step('supprimer le vélo ajouté', async () => {
      const row = page.locator('tr').filter({ hasText: bikeCode });
      await clickWithRedCursor(page, row.getByRole('button', { name: 'Supprimer' }));
      await clickWithRedCursor(page, row.getByRole('button', { name: 'Confirmer' }));
      await expect(page.locator('tr').filter({ hasText: bikeCode })).toHaveCount(0);
    });

    await test.step('ouvrir l’historique des retours', async () => {
      await clickWithRedCursor(page, page.locator('nav').getByRole('button', { name: 'Historique des retours' }));
      await expect(page.getByRole('heading', { name: 'Historique des retours' })).toBeVisible();
      await expect(page.getByText('Retour témoin sans anomalie')).toBeVisible();
      await pauseForViewer(page);
    });
  });
});
